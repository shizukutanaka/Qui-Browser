/**
 * Resolve user-typed text into a navigable URL.
 *
 * Distinguishes between an address and a search query the way mainstream
 * browsers do: text that looks like a host/URL is treated as a URL; anything
 * else becomes a search-engine query. This keeps the in-VR URL bar useful
 * without a separate "search vs go" mode.
 */

// Built-in search engines. The query is appended URL-encoded.
export const SEARCH_ENGINES = {
  duckduckgo: 'https://duckduckgo.com/?q=',
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  ecosia: 'https://www.ecosia.org/search?q='
};

export const DEFAULT_SEARCH_ENGINE = 'duckduckgo';

// A conservative single-token TLD check. We only need to recognise the common
// case (example.com, sub.example.co.jp) — anything ambiguous becomes a search.
const LOOKS_LIKE_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
// Schemes we refuse to navigate to (XSS / local-file / data-exfil vectors).
const BLOCKED_SCHEME = /^(javascript|data|file|blob|vbscript):/i;

/**
 * @param {string} input            raw text from the URL bar
 * @param {object} [opts]
 * @param {string} [opts.searchEngine]  key into SEARCH_ENGINES, or a full
 *                                       template ending in '='/'?q='
 * @returns {string|null} a navigable https URL, or null if input is empty/blocked
 */
export function resolveInput(input, opts = {}) {
  if (input === null || input === undefined) {
    return null;
  }
  const text = String(input).trim();
  if (!text) {
    return null;
  }

  // Block dangerous schemes outright.
  if (BLOCKED_SCHEME.test(text)) {
    return null;
  }

  // Already a full URL with an allowed scheme.
  if (HAS_SCHEME.test(text)) {
    return /^https?:\/\//i.test(text) ? text : null;
  }

  // localhost and bare IPs are addresses, not searches.
  const firstToken = text.split('/')[0];
  const isLocalhost = /^localhost(:\d+)?$/i.test(firstToken);
  const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(firstToken);

  // A single token with a dot and no spaces looks like a host.
  const looksLikeUrl =
    isLocalhost || isIPv4 || (!/\s/.test(text) && LOOKS_LIKE_HOST.test(text));

  if (looksLikeUrl) {
    return 'https://' + text;
  }

  // Otherwise: search query.
  return buildSearchUrl(text, opts.searchEngine);
}

/**
 * Build a search URL for the given query and engine.
 * @param {string} query
 * @param {string} [engine] key into SEARCH_ENGINES or a full template
 * @returns {string}
 */
export function buildSearchUrl(query, engine = DEFAULT_SEARCH_ENGINE) {
  const template =
    SEARCH_ENGINES[engine] ||
    (typeof engine === 'string' && engine.includes('=') ? engine : SEARCH_ENGINES[DEFAULT_SEARCH_ENGINE]);
  return template + encodeURIComponent(query);
}

/**
 * True when the text would be treated as a search query rather than a URL.
 * Useful for UI hints (e.g. a magnifying-glass vs globe icon).
 */
export function isSearchQuery(input, opts = {}) {
  const resolved = resolveInput(input, opts);
  if (!resolved) {
    return false;
  }
  // It's a search if the resolved URL is one of the search-engine endpoints.
  return Object.values(SEARCH_ENGINES).some((tpl) => resolved.startsWith(tpl)) ||
    (typeof opts.searchEngine === 'string' && opts.searchEngine.includes('=') &&
      resolved.startsWith(opts.searchEngine));
}
