/**
 * SSRF defence for the optional fetch proxy.
 *
 * Why this file is separate and pure: a fetch proxy is the one component in
 * this product that turns a user-supplied string into an outbound request from
 * a machine the user does not control. Everything that decides whether a
 * request is allowed lives here so it can be tested exhaustively without
 * opening a socket — the guard is the security boundary, and a security
 * boundary that can only be exercised by making real network calls does not
 * get tested.
 *
 * The threat: a caller asks the proxy for `http://169.254.169.254/…` (cloud
 * metadata), `http://localhost:6379` (an internal service), or a public
 * hostname whose DNS record points at a private address. Each of those turns
 * the proxy into a confused deputy with the host's network position.
 *
 * The defences, in order:
 *   1. scheme allowlist — http/https only, so `file:`, `gopher:`, `data:` and
 *      friends never reach a socket
 *   2. no credentials in the URL (`user:pass@host` also hides the real host)
 *   3. port allowlist — the standard web ports only
 *   4. literal-IP rejection for every private / reserved range
 *   5. **post-resolution** address checking — the caller must resolve the
 *      hostname and re-run `isBlockedAddress` on what DNS actually returned,
 *      which is what closes DNS-rebinding and "public name, private A record"
 *   6. the same checks re-applied to every redirect target
 *
 * Nothing here does I/O. `assertRequestAllowed` is the single entry point the
 * server calls; `isBlockedAddress` is what it must re-run after resolution.
 */

/** Schemes that may ever reach a socket. */
export const ALLOWED_SCHEMES = ['http:', 'https:'];

/** Ports the proxy will connect to. Anything else is refused. */
export const ALLOWED_PORTS = [80, 443, 8080, 8443];

/** Maximum bytes the proxy will read from an upstream response. */
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

/** Upstream timeout (ms). */
export const UPSTREAM_TIMEOUT_MS = 10_000;

/** Redirects followed before giving up. */
export const MAX_REDIRECTS = 3;

/**
 * IPv4 ranges that must never be reached through the proxy.
 * Expressed as [firstOctet, test] so the check stays readable.
 */
const V4_BLOCKED = [
  { name: 'this-network', test: (o) => o[0] === 0 },
  { name: 'loopback', test: (o) => o[0] === 127 },
  { name: 'private-10', test: (o) => o[0] === 10 },
  { name: 'shared-cgnat', test: (o) => o[0] === 100 && o[1] >= 64 && o[1] <= 127 },
  { name: 'link-local', test: (o) => o[0] === 169 && o[1] === 254 },
  { name: 'private-172', test: (o) => o[0] === 172 && o[1] >= 16 && o[1] <= 31 },
  { name: 'ietf-protocol', test: (o) => o[0] === 192 && o[1] === 0 && o[2] === 0 },
  { name: 'private-192', test: (o) => o[0] === 192 && o[1] === 168 },
  { name: 'benchmark', test: (o) => o[0] === 198 && (o[1] === 18 || o[1] === 19) },
  { name: 'reserved-240', test: (o) => o[0] >= 240 }
];

function parseV4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) {
    return null;
  }
  const o = m.slice(1).map(Number);
  return o.every((n) => n >= 0 && n <= 255) ? o : null;
}

/**
 * Expand an IPv6 address to its eight 16-bit pieces, or null if malformed.
 * '::' must compress at least one piece; a trailing dotted-quad counts as
 * two pieces (RFC 4291 §2.2) and may appear nowhere else.
 */
function parseV6Pieces(host) {
  const sides = host.split('::');
  if (sides.length > 2) {
    return null;
  }
  const left = sides[0] === '' ? [] : sides[0].split(':');
  const right = sides.length === 2 ? (sides[1] === '' ? [] : sides[1].split(':')) : [];
  const groups = [...left, ...right];
  const pieces = [];
  for (const g of groups) {
    const v4 = parseV4(g);
    if (v4) {
      if (g !== groups[groups.length - 1]) {
        return null;
      }
      pieces.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]);
    } else {
      if (!/^[0-9a-f]{1,4}$/.test(g)) {
        return null;
      }
      pieces.push(parseInt(g, 16));
    }
  }
  if (sides.length === 1) {
    return pieces.length === 8 ? pieces : null;
  }
  const zeros = 8 - pieces.length;
  if (zeros < 1) {
    return null;
  }
  return [...pieces.slice(0, left.length), ...Array(zeros).fill(0), ...pieces.slice(left.length)];
}

/**
 * Is this a literal IP address the proxy must refuse?
 *
 * Call this twice: once on the URL's hostname (catches a literal address) and
 * again on every address DNS returns (catches a public name pointing inward).
 * Skipping the second call is the classic SSRF hole.
 *
 * @param {string} address hostname or resolved IP
 * @returns {{blocked: boolean, reason?: string}}
 */
export function isBlockedAddress(address) {
  const raw = String(address === null || address === undefined ? '' : address)
    .trim()
    .toLowerCase();
  if (!raw) {
    return { blocked: true, reason: 'empty-host' };
  }
  // Strip an IPv6 bracket form and any zone index.
  const host = raw.replace(/^\[|\]$/g, '').split('%')[0];

  const v4 = parseV4(host);
  if (v4) {
    for (const range of V4_BLOCKED) {
      if (range.test(v4)) {
        return { blocked: true, reason: range.name };
      }
    }
    return { blocked: false };
  }

  if (host.includes(':')) {
    // IPv6. Classify structurally — expand the address to its 8 pieces and
    // test those. String-matching a few canonical spellings ('::1', a dotted
    // ::ffff:a.b.c.d) is the classic way this check fails: hex pairs,
    // expanded forms and other transition prefixes sail through while Node
    // happily connects them to the private target they name.
    const pieces = parseV6Pieces(host);
    if (!pieces) {
      return { blocked: true, reason: 'ipv6-malformed' };
    }
    if (pieces.every((p) => p === 0)) {
      return { blocked: true, reason: 'ipv6-unspecified' };
    }
    if (pieces.slice(0, 7).every((p) => p === 0) && pieces[7] === 1) {
      return { blocked: true, reason: 'ipv6-loopback' };
    }
    // Forms that smuggle an IPv4 inside an IPv6 tuple. Whichever notation
    // wrote it, the socket reaches the embedded v4 — so run the same range
    // table on it. Public embedded v4 (e.g. ::ffff:8.8.8.8) stays allowed.
    const embeddedAt =
      pieces.slice(0, 5).every((p) => p === 0) && pieces[5] === 0xffff
        ? 6 // ::ffff:/96
        : pieces.slice(0, 6).every((p) => p === 0)
          ? 6 // ::/96 compatible
          : pieces[0] === 0x0064 && pieces[1] === 0xff9b && pieces.slice(2, 6).every((p) => p === 0)
            ? 6 // NAT64 64:ff9b::/96
            : pieces[0] === 0x2002
              ? 1 // 6to4 2002::/16
              : null;
    if (embeddedAt !== null) {
      const o = [
        pieces[embeddedAt] >> 8,
        pieces[embeddedAt] & 0xff,
        pieces[embeddedAt + 1] >> 8,
        pieces[embeddedAt + 1] & 0xff
      ];
      const hit = V4_BLOCKED.find((range) => range.test(o));
      // 'ipv4-mapped-private' is the established reason name for any v4 that
      // arrives wearing a v6 costume, whichever transition form wrote it.
      return hit ? { blocked: true, reason: 'ipv4-mapped-private' } : { blocked: false };
    }
    const first = pieces[0];
    if (first >= 0xfc00 && first <= 0xfdff) {
      return { blocked: true, reason: 'ipv6-unique-local' };
    }
    if (first >= 0xfe00 && first <= 0xfeff) {
      // fe80::/10 link-local plus the deprecated fec0::/10 site-local space.
      return { blocked: true, reason: 'ipv6-link-local' };
    }
    if (first >= 0xff00) {
      return { blocked: true, reason: 'ipv6-multicast' };
    }
    return { blocked: false };
  }

  // Hostnames that always mean "this machine" or an internal network.
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return { blocked: true, reason: 'localhost' };
  }
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) {
    return { blocked: true, reason: 'internal-tld' };
  }
  // A bare label with no dot is a LAN name, not a public site.
  if (!host.includes('.')) {
    return { blocked: true, reason: 'bare-hostname' };
  }
  return { blocked: false };
}

/**
 * Validate a caller-supplied target URL before any socket is opened.
 *
 * Returns the parsed URL on success so the caller cannot accidentally use a
 * different string than the one that was checked.
 *
 * @param {string} target
 * @returns {{ok: true, url: URL} | {ok: false, reason: string}}
 */
export function assertRequestAllowed(target) {
  let url;
  try {
    url = new URL(String(target));
  } catch {
    return { ok: false, reason: 'unparseable-url' };
  }
  if (!ALLOWED_SCHEMES.includes(url.protocol)) {
    return { ok: false, reason: `scheme-not-allowed:${url.protocol}` };
  }
  // `https://user:pass@evil` also disguises which host is really contacted.
  if (url.username || url.password) {
    return { ok: false, reason: 'credentials-in-url' };
  }
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!ALLOWED_PORTS.includes(port)) {
    return { ok: false, reason: `port-not-allowed:${port}` };
  }
  const blocked = isBlockedAddress(url.hostname);
  if (blocked.blocked) {
    return { ok: false, reason: `host-blocked:${blocked.reason}` };
  }
  return { ok: true, url };
}

/**
 * Headers that may be forwarded upstream. Everything else — cookies,
 * authorization, forwarding headers that leak the caller — is dropped, so the
 * proxy cannot be used to replay a caller's credentials.
 *
 * @param {object} [headers]
 * @returns {object}
 */
export function safeUpstreamHeaders(headers = {}) {
  const out = {
    // Identify honestly; some sites reject an empty UA outright.
    'user-agent': 'Qui-Browser-Reader/1.0 (+https://github.com/shizukutanaka/Qui-Browser)',
    accept: 'text/html,application/xhtml+xml'
  };
  const lang = headers['accept-language'];
  if (typeof lang === 'string' && lang.length < 200) {
    out['accept-language'] = lang;
  }
  return out;
}

/**
 * Only markup is useful to the reader, and refusing everything else keeps the
 * proxy from being a general-purpose file relay.
 *
 * @param {string} [contentType]
 * @returns {boolean}
 */
export function isReadableContentType(contentType) {
  const ct = String(contentType || '').toLowerCase();
  return ct.startsWith('text/html') || ct.startsWith('application/xhtml+xml') || ct.startsWith('text/plain');
}
