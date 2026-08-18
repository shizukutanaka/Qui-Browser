/**
 * Origin-preserving URL display for the in-VR address bar.
 *
 * The address bar is the user's only signal of *which site they are actually
 * on*, so how it renders a URL is a safety property, not cosmetics. The
 * previous rendering used `truncate()` (keep the prefix, ellipsize the tail),
 * which is wrong for URLs in two ways an attacker can exploit:
 *
 *   1. **userinfo spoofing** — `https://www.google.com@evil.com/` reads
 *      left-to-right as "google.com…", but the real host is `evil.com`.
 *      Prefix-preserving truncation shows the lie and hides the truth.
 *   2. **origin pushed out by length** — a padded subdomain chain such as
 *      `https://www.paypal.com.verify.secure.session-0123456789.evil.ru/`
 *      exceeds the bar's ~61-character budget, so the real registrable domain
 *      is ellipsized away and the user reads "www.paypal.com.verify.secure…".
 *
 * The fix is to stop treating a URL as a string and treat it as a structure:
 * parse it, and render the **origin verbatim, never elided**, eliding the path
 * instead. These helpers are pure and dependency-free so the security-relevant
 * decisions are unit-testable without a canvas.
 */

import { truncate } from './bookmarkLayout.js';

/**
 * Security posture of a URL, for the address-bar indicator.
 *
 * - 'secure'   — https, the only transport that authenticates the origin
 * - 'insecure' — http (or ws): cleartext, origin not authenticated
 * - 'local'    — localhost / 127.0.0.1: cleartext but not attacker-reachable,
 *                and a secure context per the W3C definition
 * - 'none'     — nothing to report (empty address bar)
 *
 * @param {string} url
 * @returns {'secure'|'insecure'|'local'|'none'}
 */
export function securityLevel(url) {
  const s = String(url === null || url === undefined ? '' : url).trim();
  if (!s) {
    return 'none';
  }
  const parsed = safeParse(s);
  if (!parsed) {
    return 'none';
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost')) {
    return 'local';
  }
  return parsed.protocol === 'https:' ? 'secure' : 'insecure';
}

/** `new URL()` that returns null instead of throwing. */
function safeParse(s) {
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

/**
 * Decompose a URL into the parts the address bar renders separately.
 *
 * `host` is taken from the parsed URL (never from the raw string), so
 * userinfo can never masquerade as the host: for
 * `https://www.google.com@evil.com/x` this returns host `evil.com`.
 *
 * @param {string} url
 * @returns {{
 *   valid: boolean, scheme: string, host: string, rest: string,
 *   security: 'secure'|'insecure'|'local'|'none', hasUserinfo: boolean, raw: string
 * }}
 */
export function parseDisplayUrl(url) {
  const raw = String(url === null || url === undefined ? '' : url).trim();
  const parsed = safeParse(raw);
  if (!parsed) {
    // Not parseable (e.g. a partially-typed address): render it verbatim
    // rather than inventing structure we can't verify.
    return {
      valid: false, scheme: '', host: '', rest: raw,
      security: 'none', hasUserinfo: false, raw
    };
  }
  return {
    valid: true,
    scheme: parsed.protocol.replace(':', ''),
    host: parsed.host, // includes :port when present
    rest: `${parsed.pathname}${parsed.search}${parsed.hash}`,
    security: securityLevel(raw),
    // username/password before the host is essentially only used to deceive
    // in a browser address bar; surface it so the caller can flag it.
    hasUserinfo: parsed.username !== '' || parsed.password !== '',
    raw
  };
}

/**
 * Build the address-bar string, guaranteeing the origin stays visible.
 *
 * The origin (`host`, plus an `http://` scheme shown explicitly because it is
 * a warning) is never elided. Only the path/query/hash is shortened, from the
 * tail, to fit `maxChars`. If even the origin alone exceeds the budget the
 * host is returned whole and allowed to fill the bar — showing a complete
 * true host matters more than fitting.
 *
 * `https://` is omitted (the lock glyph carries that signal, matching
 * mainstream browsers); `http://` is kept visible precisely because it is the
 * unsafe case and should not be silently hidden.
 *
 * @param {string} url
 * @param {number} [maxChars=61] code-point budget for the bar
 * @returns {string}
 */
export function elideUrlForDisplay(url, maxChars = 61) {
  const d = parseDisplayUrl(url);
  const budget = Math.max(1, Math.floor(maxChars));

  if (!d.valid) {
    // Unparseable: fall back to plain truncation, which is safe here because
    // there is no origin structure to protect.
    return truncate(d.raw, budget);
  }

  const prefix = d.security === 'insecure' ? `${d.scheme}://` : '';
  const origin = `${prefix}${d.host}`;
  const originLen = Array.from(origin).length;

  // Origin alone fills (or overflows) the bar — show the true host in full.
  if (originLen >= budget) {
    return origin;
  }

  const path = d.rest === '/' ? '' : d.rest;
  if (!path) {
    return origin;
  }

  const room = budget - originLen;
  const pathChars = Array.from(path);
  if (pathChars.length <= room) {
    return origin + path;
  }
  // Ellipsize the path tail; the origin above is untouched.
  return origin + (room > 1 ? pathChars.slice(0, room - 1).join('') + '…' : '…');
}

/**
 * Text for the content area, given the panel's content state.
 *
 * Pure so the wording — which is the app's honesty contract with the user
 * about what it can actually display — is pinned by tests rather than buried
 * in a canvas draw call.
 *
 * @param {'empty'|'loading'|'unavailable'|'error'} state
 * @param {string} [url]
 * @param {boolean} [hasProxy=false] whether a companion reader proxy is configured
 * @returns {{title: string, detail: string}}
 */
export function contentStateLines(state, url = '', hasProxy = false) {
  const host = parseDisplayUrl(url).host;
  switch (state) {
  case 'loading':
    return { title: 'Loading…', detail: host };
  case 'unavailable':
    // Honest AND actionable. It used to say only "in-headset rendering is not
    // supported", which was a dead end and, once the companion proxy existed,
    // no longer even accurate — with a proxy configured, rendering works.
    // Measured cause: general sites send no Access-Control-Allow-Origin on
    // their HTML, so the browser cannot fetch them directly. Saying which of
    // the two situations the user is in is the difference between "this is
    // broken" and "here is the one thing that fixes it".
    return hasProxy
      ? {
        title: 'Could not read this page',
        detail: host
          ? `${host} — the reader proxy could not fetch it`
          : 'The reader proxy could not fetch this page'
      }
      : {
        title: 'This site does not allow direct reading',
        detail: host
          ? `${host} sends no CORS header — run a reader proxy (docs/PROXY.md)`
          : 'Site sends no CORS header — run a reader proxy (docs/PROXY.md)'
      };
  case 'error':
    return { title: 'Failed to load', detail: host };
  default:
    return { title: 'Enter a URL to navigate', detail: '' };
  }
}

/**
 * Glyph + colour for the security indicator, kept next to the level logic so
 * the mapping is testable and consistent. Colour-blind safe: the glyph carries
 * the meaning, colour only reinforces it (WCAG 1.4.1 — not colour alone).
 *
 * @param {'secure'|'insecure'|'local'|'none'} level
 * @param {boolean} [highContrast=false]
 * @returns {{glyph: string, color: string}}
 */
export function securityIndicator(level, highContrast = false) {
  switch (level) {
  case 'secure':
    return { glyph: '🔒', color: highContrast ? '#ffffff' : '#7fdca4' };
  case 'insecure':
    return { glyph: '⚠', color: highContrast ? '#ffdd00' : '#ffb454' };
  case 'local':
    return { glyph: '⌂', color: highContrast ? '#ffffff' : '#9db4d0' };
  default:
    return { glyph: '', color: highContrast ? '#ffffff' : '#888899' };
  }
}

/**
 * The URL the reader should actually fetch for a target page.
 *
 * Measured fact this exists for: no general site sends
 * `Access-Control-Allow-Origin` on its HTML (Wikipedia, MDN, example.com and
 * NHK all send none), so a browser-side reader cannot fetch pages directly. A
 * user who runs the optional companion proxy (`proxy/server.js`) can point the
 * reader at it and read the real web; a user who does not gets exactly today's
 * behaviour — direct fetch, limited to CORS-enabled origins.
 *
 * Pure so both branches are testable without a network.
 *
 * @param {string} target    the page the user asked for
 * @param {string} [proxyUrl] base URL of the companion proxy, '' when unset
 * @returns {string} the URL to fetch
 */
export function readerFetchUrl(target, proxyUrl = '') {
  const t = String(target == null ? '' : target);
  const base = String(proxyUrl == null ? '' : proxyUrl).trim().replace(/\/+$/, '');
  if (!base) {
    return t;
  }
  return `${base}/fetch?url=${encodeURIComponent(t)}`;
}
