/**
 * Optional fetch proxy for the VR reader.
 *
 * This is the one piece Session 74 deliberately added back after deleting the
 * old `server/` directory — Musk's "if you're not adding back 10%, you didn't
 * delete enough". The deleted server was a Stripe billing router with no
 * client; this one exists because of a measured fact: **no general site sends
 * `Access-Control-Allow-Origin` on its HTML** (Wikipedia, MDN, example.com and
 * NHK all send none), so a browser-side reader cannot fetch pages itself.
 *
 * It is deliberately NOT part of the shipped app:
 *   - the default deploy target is GitHub Pages, which is static and cannot run
 *     this, so bundling it would be a lie
 *   - it is a network attack surface, and nobody should get one they did not
 *     ask for
 *
 * Run it yourself, point the reader at it, and the reader reads the real web.
 * Do not run it, and the reader is limited to CORS-enabled origins — which is
 * exactly the behaviour that ships today.
 *
 *   node proxy/server.js            # listens on 8080 by default
 *   PORT=9000 ALLOW_ORIGIN=https://example.com node proxy/server.js
 *
 * Zero dependencies: Node's own http/https. Every access decision lives in
 * ssrfGuard.js and is unit-tested there.
 */

import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { lookup } from 'node:dns/promises';
import {
  assertRequestAllowed,
  isBlockedAddress,
  safeUpstreamHeaders,
  isReadableContentType,
  MAX_RESPONSE_BYTES,
  UPSTREAM_TIMEOUT_MS,
  MAX_REDIRECTS
} from './ssrfGuard.js';

const PORT = Number(process.env.PORT || 8080);
/** Which page origins may call this proxy. `*` is fine for a personal instance. */
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

/**
 * Resolve a hostname and refuse if ANY returned address is internal.
 *
 * This is the check that actually stops SSRF. Validating the URL string alone
 * is not enough: `evil.example.com` is a perfectly ordinary public name that
 * can carry an A record of 127.0.0.1. Every address is checked, not just the
 * first, so a mixed record set cannot slip one through.
 *
 * @param {string} hostname
 * @returns {Promise<{ok: true, address: string, family: number} | {ok: false, reason: string}>}
 */
async function resolveSafely(hostname) {
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    return { ok: false, reason: 'dns-failed' };
  }
  if (!addresses.length) {
    return { ok: false, reason: 'dns-empty' };
  }
  for (const a of addresses) {
    const blocked = isBlockedAddress(a.address);
    if (blocked.blocked) {
      return { ok: false, reason: `resolved-to-blocked:${blocked.reason}` };
    }
  }
  return { ok: true, address: addresses[0].address, family: addresses[0].family };
}

/**
 * Parse a redirect's Location header. Those bytes come from the upstream,
 * not from our caller — and `new URL` throws on malformed input, which would
 * reject fetchThroughGuard inside the async request handler (the socket then
 * never answers, and under Node's default unhandled-rejection policy the
 * process dies). `assertRequestAllowed` guards the initial target the same
 * way; redirect hops need the guard too.
 *
 * @param {string} location
 * @param {URL} base
 * @returns {URL | null}
 */
function redirectTarget(location, base) {
  try {
    return new URL(location, base);
  } catch {
    return null;
  }
}

/**
 * Decode an upstream body using the charset the response declared. A missing
 * or unsupported label falls back to UTF-8 — the WHATWG fetch default — rather
 * than throwing. Node's TextDecoder knows the full label set (shift_jis,
 * euc-jp, windows-125x, …), which matters here: non-UTF-8 pages are still
 * common on the Japanese web this product targets, and decoding them as UTF-8
 * returned U+FFFD mojibake.
 *
 * @param {Buffer} buffer
 * @param {string} [contentType]
 * @returns {string}
 */
function decodeBody(buffer, contentType) {
  const m = /charset\s*=\s*"?([^\s";]+)"?/i.exec(String(contentType || ''));
  const label = m ? m[1] : 'utf-8';
  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

/**
 * Fetch a URL with the full guard applied at every hop.
 *
 * Redirects are followed manually rather than by a library, because each hop is
 * a fresh SSRF opportunity: a public URL is allowed to redirect to
 * `http://169.254.169.254/`, and a client that follows redirects automatically
 * would take it.
 *
 * @param {string} target
 * @param {object} [headers]
 * @returns {Promise<{ok: true, status: number, contentType: string, body: string, finalUrl: string} | {ok: false, reason: string}>}
 */
export async function fetchThroughGuard(target, headers = {}) {
  let current = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = assertRequestAllowed(current);
    if (!check.ok) {
      return { ok: false, reason: check.reason };
    }
    const url = check.url;
    const dns = await resolveSafely(url.hostname);
    if (!dns.ok) {
      return { ok: false, reason: dns.reason };
    }

    const res = await new Promise((resolve) => {
      const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = send(
        url,
        {
          method: 'GET',
          headers: { ...safeUpstreamHeaders(headers), host: url.host },
          timeout: UPSTREAM_TIMEOUT_MS,
          // Pin the socket to the address resolveSafely just validated.
          // Without this the connect re-resolves the hostname — a second,
          // unchecked DNS answer — so a record that changes between lookups
          // (rebinding) would route the socket past the guard.
          lookup: (_hostname, options, cb) => {
            if (options.all) {
              cb(null, [{ address: dns.address, family: dns.family }]);
            } else {
              cb(null, dns.address, dns.family);
            }
          }
        },
        (r) => resolve({ kind: 'response', r })
      );
      req.on('timeout', () => {
        req.destroy();
        resolve({ kind: 'error', reason: 'upstream-timeout' });
      });
      req.on('error', () => resolve({ kind: 'error', reason: 'upstream-error' }));
      req.end();
    });

    if (res.kind === 'error') {
      return { ok: false, reason: res.reason };
    }
    const r = res.r;

    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
      r.resume(); // drain
      const next = redirectTarget(r.headers.location, url);
      if (!next) {
        return { ok: false, reason: 'invalid-redirect-location' };
      }
      current = next.toString();
      continue;
    }

    if (!isReadableContentType(r.headers['content-type'])) {
      r.resume();
      return { ok: false, reason: `content-type-not-readable:${r.headers['content-type'] || 'none'}` };
    }

    const body = await new Promise((resolve) => {
      let size = 0;
      const chunks = [];
      r.on('data', (c) => {
        size += c.length;
        if (size > MAX_RESPONSE_BYTES) {
          r.destroy();
          resolve(null);
          return;
        }
        chunks.push(c);
      });
      r.on('end', () => resolve(Buffer.concat(chunks)));
      r.on('error', () => resolve(null));
    });
    if (body === null) {
      return { ok: false, reason: 'response-too-large-or-truncated' };
    }
    return {
      ok: true,
      status: r.statusCode,
      contentType: r.headers['content-type'] || '',
      body: decodeBody(body, r.headers['content-type']),
      finalUrl: url.toString()
    };
  }
  return { ok: false, reason: 'too-many-redirects' };
}

function cors(res) {
  res.setHeader('access-control-allow-origin', ALLOW_ORIGIN);
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}

function createProxyServer() {
  return createServer(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    if (req.method !== 'GET') {
      res.writeHead(405, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'method-not-allowed' }));
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname !== '/fetch') {
      res.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'not-found' }));
      return;
    }
    const target = url.searchParams.get('url');
    if (!target) {
      res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'missing-url' }));
      return;
    }
    const out = await fetchThroughGuard(target, req.headers);
    if (!out.ok) {
      // The reason is returned so the reader can say something honest, but it
      // never includes anything resolved about the internal network.
      res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: out.reason }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(out.body);
  });
}

// Only listen when run directly.
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  createProxyServer().listen(PORT, () => {
    console.log(`Qui-Browser reader proxy on http://127.0.0.1:${PORT}`);
    console.log(`  GET /fetch?url=https://example.com/article   (allowed origin: ${ALLOW_ORIGIN})`);
  });
}
