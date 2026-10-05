/**
 * Unit tests for the URL/search resolver used by the in-VR address bar.
 */

const { resolveInput, DEFAULT_SEARCH_ENGINE, searchEngineHosts } = require('../src/vr/browser/urlResolver.js');

// Literal search-URL templates — asserting against the module's own registry
// would make the expectations tautological (a wrong template would still
// pass), so the expected URLs are written out.
const DDG = 'https://duckduckgo.com/?q=';
const GOOGLE = 'https://www.google.com/search?q=';
const ENGINE_HOSTS = ['duckduckgo.com', 'www.google.com', 'www.bing.com', 'www.ecosia.org'];

// NFD "が" = か (U+304B) + combining voiced sound mark (U+3099) → 2 code points.
// NFC "が" = the single precomposed code point (U+304C)        → 1 code point.
// Built from escapes so the fixtures don't depend on the file's byte encoding.
const GA_NFD = 'が';
const GA_NFC = 'が';

describe('resolveInput', () => {
  // ── empty / invalid ───────────────────────────────────────────────────────
  test('returns null for null/empty/whitespace', () => {
    expect(resolveInput(null)).toBeNull();
    expect(resolveInput('')).toBeNull();
    expect(resolveInput('   ')).toBeNull();
  });

  // ── blocked schemes ─────────────────────────────────────────────────────────
  test('blocks javascript: scheme', () => {
    expect(resolveInput('javascript:alert(1)')).toBeNull();
  });
  test('blocks data: scheme', () => {
    expect(resolveInput('data:text/html,<script>')).toBeNull();
  });
  test('blocks file: scheme', () => {
    expect(resolveInput('file:///etc/passwd')).toBeNull();
  });
  test('blocks non-http scheme like ftp', () => {
    expect(resolveInput('ftp://example.com')).toBeNull();
  });

  // ── full URLs ───────────────────────────────────────────────────────────────
  test('passes through https URLs unchanged', () => {
    expect(resolveInput('https://example.com/path')).toBe('https://example.com/path');
  });
  test('passes through http URLs unchanged', () => {
    expect(resolveInput('http://example.com')).toBe('http://example.com');
  });

  // ── bare hosts → https ────────────────────────────────────────────────────
  test('prepends https to a bare domain', () => {
    expect(resolveInput('example.com')).toBe('https://example.com');
  });
  test('prepends https to a domain with path', () => {
    expect(resolveInput('example.com/foo/bar')).toBe('https://example.com/foo/bar');
  });
  test('handles subdomains and multi-part TLDs', () => {
    expect(resolveInput('sub.example.co.jp')).toBe('https://sub.example.co.jp');
  });
  test('treats localhost as a URL', () => {
    expect(resolveInput('localhost:5173')).toBe('https://localhost:5173');
  });
  test('treats bare IPv4 as a URL', () => {
    expect(resolveInput('192.168.1.1')).toBe('https://192.168.1.1');
  });

  // ── internationalized domain names (IDN) — Japanese browser ────────────────
  test('navigates a Japanese IDN with an ASCII TLD (日本語.jp)', () => {
    // Previously this fell through to the search engine because the host regex
    // was ASCII-only; a JP user could not reach a Japanese-named site directly.
    expect(resolveInput('日本語.jp')).toBe('https://日本語.jp');
  });
  test('navigates an all-Japanese IDN with a Japanese TLD (例え.テスト)', () => {
    expect(resolveInput('例え.テスト')).toBe('https://例え.テスト');
  });
  test('navigates a Japanese IDN with a path', () => {
    expect(resolveInput('日本語.jp/ページ')).toBe('https://日本語.jp/ページ');
  });
  test('the resolved IDN URL is punycode-convertible by the URL layer', () => {
    // The browser/iframe converts the Unicode host to punycode on navigation;
    // confirm the resolver's output is a valid, convertible URL.
    expect(new URL(resolveInput('日本語.jp')).host).toBe('xn--wgv71a119e.jp');
  });
  test('Japanese text without a dot is still a search, not a host', () => {
    expect(resolveInput('東京タワー')).toBe(DDG + encodeURIComponent('東京タワー'));
  });
  test('Japanese text with a full-width space is still a search', () => {
    // U+3000 (ideographic space) is matched by \s, so this stays a query.
    expect(resolveInput('東京　天気')).toBe(DDG + encodeURIComponent('東京　天気'.normalize('NFC')));
  });

  // ── search queries ──────────────────────────────────────────────────────────
  test('single word becomes a search', () => {
    expect(resolveInput('weather')).toBe(DDG + 'weather');
  });
  test('multi-word phrase becomes a search', () => {
    expect(resolveInput('best vr browser')).toBe(DDG + encodeURIComponent('best vr browser'));
  });
  test('text with a dot but spaces becomes a search', () => {
    expect(resolveInput('what is three.js')).toBe(DDG + encodeURIComponent('what is three.js'));
  });
  test('query characters are URL-encoded', () => {
    expect(resolveInput('a & b')).toBe(DDG + 'a%20%26%20b');
  });

  // ── engine selection ──────────────────────────────────────────────────────
  test('respects google engine', () => {
    expect(resolveInput('cats', { searchEngine: 'google' })).toBe(GOOGLE + 'cats');
  });
  test('falls back to default for unknown engine key', () => {
    expect(DEFAULT_SEARCH_ENGINE).toBe('duckduckgo');
    expect(resolveInput('cats', { searchEngine: 'nope' })).toBe(DDG + 'cats');
  });
  test('accepts a full template string as engine', () => {
    expect(resolveInput('cats', { searchEngine: 'https://s.example/?q=' })).toBe('https://s.example/?q=cats');
  });

  // ── Unicode normalization (NFD → NFC) ─────────────────────────────────────
  test('normalizes NFD input to NFC before building a search query', () => {
    expect(GA_NFD.normalize('NFC')).toBe(GA_NFC); // sanity-check the fixtures
    expect(Array.from(GA_NFD)).toHaveLength(2);
    expect(Array.from(GA_NFC)).toHaveLength(1);
    const out = resolveInput(GA_NFD, { searchEngine: 'https://s.example/?q=' });
    expect(out).toBe('https://s.example/?q=' + encodeURIComponent(GA_NFC));
  });

  test('NFD and NFC of the same word resolve identically', () => {
    const opts = { searchEngine: 'https://s.example/?q=' };
    expect(resolveInput(GA_NFD, opts)).toBe(resolveInput(GA_NFC, opts));
  });
});

describe('searchEngineHosts', () => {
  test('derives the host of every built-in search engine', () => {
    const hosts = searchEngineHosts();
    for (const h of ENGINE_HOSTS) {
      expect(hosts).toContain(h);
    }
    expect(hosts).toHaveLength(ENGINE_HOSTS.length);
  });

  test('returns lowercased, non-empty hosts', () => {
    for (const h of searchEngineHosts()) {
      expect(h).toBe(h.toLowerCase());
      expect(h.length).toBeGreaterThan(0);
    }
  });
});
