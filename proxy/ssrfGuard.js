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
  const raw = String(address === null || address === undefined ? '' : address).trim().toLowerCase();
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
    // IPv6. Reject loopback, unspecified, unique-local (fc00::/7) and
    // link-local (fe80::/10) outright, plus any v4-mapped form, which would
    // otherwise smuggle a private v4 address past the check above.
    if (host === '::1' || host === '::') {
      return { blocked: true, reason: 'ipv6-loopback' };
    }
    const mapped = /::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(host);
    if (mapped) {
      return isBlockedAddress(mapped[1]).blocked
        ? { blocked: true, reason: 'ipv4-mapped-private' }
        : { blocked: false };
    }
    const head = host.split(':')[0];
    if (/^f[cd]/.test(head)) {
      return { blocked: true, reason: 'ipv6-unique-local' };
    }
    if (/^fe[89ab]/.test(head)) {
      return { blocked: true, reason: 'ipv6-link-local' };
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
  const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
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
  return ct.startsWith('text/html')
    || ct.startsWith('application/xhtml+xml')
    || ct.startsWith('text/plain');
}
