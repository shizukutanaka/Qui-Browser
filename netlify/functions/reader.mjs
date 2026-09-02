/**
 * Reader proxy as a serverless function, so a deployment can read the whole web.
 *
 * ## Why this exists
 *
 * The reader fetches page markup from the browser, which reaches only origins
 * that send `Access-Control-Allow-Origin`. Measured, four of four ordinary
 * sites send none (see docs/PROXY.md), so without a proxy most navigations end
 * on the honest "cannot be shown" screen.
 *
 * `proxy/server.js` closes that gap but has to be run by hand on a machine the
 * user owns — fine for a LAN, useless for a deployed app, and impossible on the
 * default GitHub Pages target, which is static. This is the same capability as
 * a function the deploy already runs, so a Netlify deploy gets a same-origin
 * reader proxy with no extra operations at all. Nothing here changes the
 * GitHub Pages build: no function, no endpoint, and the client falls back to
 * direct fetch exactly as before.
 *
 * ## Security
 *
 * Every access decision is `proxy/ssrfGuard.js` and `fetchThroughGuard`, shared
 * verbatim with the standalone server rather than reimplemented — a second
 * copy of SSRF logic is a second thing to get wrong. That means scheme and port
 * allowlists, rejection of literal private/reserved addresses, a re-check of
 * every DNS-resolved address, a re-check at every redirect hop, content-type
 * and size limits, and no forwarding of cookies or authorization. 51 tests
 * cover the pure half without opening a socket.
 *
 * Unlike the standalone server this is reachable by anyone who can reach the
 * deployment. It is still a fetch-and-return-text relay bounded by all of the
 * above, but if that is not acceptable for your deployment, delete this file —
 * the app works without it.
 */

import { fetchThroughGuard } from '../../proxy/server.js';

/** Same-origin by default: the page and the function share an origin. */
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

const BASE_HEADERS = {
  'access-control-allow-origin': ALLOW_ORIGIN,
  'access-control-allow-methods': 'GET, OPTIONS',
  'cache-control': 'no-store'
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: BASE_HEADERS });
  }
  if (request.method !== 'GET') {
    return json(405, { error: 'method-not-allowed' });
  }

  const url = new URL(request.url);
  // `/health` lets the client detect that a deployment has a proxy without
  // sending it a real target first.
  if (url.pathname.endsWith('/health')) {
    return json(200, { ok: true });
  }

  const target = url.searchParams.get('url');
  if (!target) {
    return json(400, { error: 'missing-url' });
  }

  let out;
  try {
    out = await fetchThroughGuard(target, {
      'accept-language': request.headers.get('accept-language') || ''
    });
  } catch {
    // Never leak a stack trace: the message could echo internal hostnames.
    return json(502, { error: 'upstream-failed' });
  }
  if (!out.ok) {
    return json(400, { error: out.reason });
  }
  return new Response(out.body, {
    status: 200,
    headers: { ...BASE_HEADERS, 'content-type': 'text/plain; charset=utf-8' }
  });
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, 'content-type': 'application/json; charset=utf-8' }
  });
}

// Mirrors the standalone server's contract (`/fetch?url=`, `/health`) so the
// client's `readerFetchUrl` builds the same URL for either one — a deployment
// sets its proxy base to `/api/reader` and nothing else differs.
export const config = {
  path: ['/api/reader', '/api/reader/fetch', '/api/reader/health']
};
