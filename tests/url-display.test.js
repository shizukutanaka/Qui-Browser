/**
 * Address-bar rendering is a safety property: it is the user's only signal of
 * which site they are actually on. These tests pin the two spoofing vectors the
 * previous prefix-truncation rendering was vulnerable to (userinfo, and an
 * origin pushed out of view by length), plus the security-level derivation.
 *
 * All pure — no canvas, no THREE.
 */

const {
  parseDisplayUrl, elideUrlForDisplay, securityLevel, securityIndicator,
  contentStateLines
} = require('../src/vr/browser/urlDisplay.js');

const len = (s) => Array.from(s).length;

describe('parseDisplayUrl — host comes from the parser, never the raw string', () => {
  test('userinfo cannot masquerade as the host', () => {
    // Reads left-to-right as "google.com"; the real host is evil.com.
    const d = parseDisplayUrl('https://www.google.com@evil.com/login');
    expect(d.host).toBe('evil.com');
    expect(d.hasUserinfo).toBe(true);
  });

  test('a password-style userinfo is also flagged', () => {
    const d = parseDisplayUrl('https://user:pass@evil.example/x');
    expect(d.host).toBe('evil.example');
    expect(d.hasUserinfo).toBe(true);
  });

  test('an ordinary URL has no userinfo and splits into origin + path', () => {
    const d = parseDisplayUrl('https://example.com/a/b?q=1#f');
    expect(d.host).toBe('example.com');
    expect(d.hasUserinfo).toBe(false);
    expect(d.rest).toBe('/a/b?q=1#f');
    expect(d.valid).toBe(true);
  });

  test('port is retained as part of the host', () => {
    expect(parseDisplayUrl('http://localhost:5173/x').host).toBe('localhost:5173');
  });

  test('an unparseable / partially-typed address is reported invalid, not invented', () => {
    const d = parseDisplayUrl('https://');
    expect(d.valid).toBe(false);
    expect(d.host).toBe('');
  });

  test('null / undefined are safe', () => {
    expect(parseDisplayUrl(null).valid).toBe(false);
    expect(parseDisplayUrl(undefined).raw).toBe('');
  });
});

describe('elideUrlForDisplay — the origin is never elided', () => {
  test('a long deceptive subdomain chain still shows the real registrable domain', () => {
    // The pre-fix rendering truncated the tail, so the user saw
    // "https://www.paypal.com.verify.secure…" and never the real host.
    const url = 'https://www.paypal.com.verify.secure.session-0123456789.evil.ru/account';
    const out = elideUrlForDisplay(url, 61);
    expect(out).toContain('evil.ru');
  });

  test('userinfo is dropped from the display entirely (only the true host shows)', () => {
    const out = elideUrlForDisplay('https://www.google.com@evil.com/login', 61);
    expect(out).toContain('evil.com');
    expect(out).not.toContain('google.com');
  });

  test('a long path is ellipsized while the host survives intact', () => {
    const url = 'https://example.com/' + 'segment/'.repeat(30);
    const out = elideUrlForDisplay(url, 40);
    expect(out.startsWith('example.com/')).toBe(true);
    expect(out.endsWith('…')).toBe(true);
    expect(len(out)).toBeLessThanOrEqual(40);
  });

  test('an origin longer than the whole budget is shown in full rather than cut', () => {
    // Showing a complete true host matters more than fitting the bar.
    const host = 'a'.repeat(80) + '.example';
    const out = elideUrlForDisplay(`https://${host}/p`, 61);
    expect(out).toBe(host);
  });

  test('https:// is omitted (the lock glyph carries it) but http:// stays visible', () => {
    expect(elideUrlForDisplay('https://example.com/', 61)).toBe('example.com');
    expect(elideUrlForDisplay('http://example.com/', 61)).toBe('http://example.com');
  });

  test('a bare root path is not rendered as a trailing slash', () => {
    expect(elideUrlForDisplay('https://example.com/', 61)).toBe('example.com');
  });

  test('short ordinary URLs are unchanged apart from the https prefix', () => {
    expect(elideUrlForDisplay('https://example.com/docs', 61)).toBe('example.com/docs');
  });

  test('unparseable input falls back to plain truncation without throwing', () => {
    expect(() => elideUrlForDisplay('not a url at all', 10)).not.toThrow();
    expect(len(elideUrlForDisplay('x'.repeat(50), 10))).toBeLessThanOrEqual(10);
  });
});

describe('securityLevel', () => {
  test('https is secure', () => {
    expect(securityLevel('https://example.com')).toBe('secure');
  });

  test('http is insecure — cleartext, origin unauthenticated', () => {
    expect(securityLevel('http://example.com')).toBe('insecure');
  });

  test('localhost is treated as local (a secure context, not attacker-reachable)', () => {
    expect(securityLevel('http://localhost:5173/')).toBe('local');
    expect(securityLevel('http://127.0.0.1:8080/')).toBe('local');
  });

  test('an empty or unparseable address reports nothing', () => {
    expect(securityLevel('')).toBe('none');
    expect(securityLevel(null)).toBe('none');
    expect(securityLevel('https://')).toBe('none');
  });

  test('a userinfo-spoofed https URL is judged on its REAL host', () => {
    // Still https (so 'secure' transport), but the indicator must not be the
    // only signal — elideUrlForDisplay is what reveals evil.com.
    expect(securityLevel('https://www.google.com@evil.com')).toBe('secure');
    expect(elideUrlForDisplay('https://www.google.com@evil.com', 61)).toContain('evil.com');
  });
});

describe('contentStateLines — the viewport states honestly what it can show', () => {
  test('empty panel invites a URL', () => {
    expect(contentStateLines('empty').title).toMatch(/Enter a URL/i);
  });

  test('loading names the host being fetched', () => {
    const l = contentStateLines('loading', 'https://example.com/a');
    expect(l.title).toMatch(/Loading/i);
    expect(l.detail).toBe('example.com');
  });

  test('a completed navigation reports the real state — not a stale "enter a URL"', () => {
    // The regression this pins: after a navigation the user believes succeeded,
    // the viewport used to keep reading "Enter a URL to navigate" forever,
    // implying nothing had happened.
    const l = contentStateLines('unavailable', 'https://example.com/a');
    expect(l.title).not.toMatch(/Enter a URL/i);
    expect(l.detail).toContain('example.com');
  });

  test('without a proxy it names the cause AND the fix, not just "unsupported"', () => {
    // It used to say only "in-headset rendering is not supported" — a dead end.
    // The measured cause is that sites send no CORS header, and the companion
    // proxy is the one thing that changes it.
    const l = contentStateLines('unavailable', 'https://example.com/a', false);
    expect(l.detail).toMatch(/CORS/i);
    expect(l.detail).toMatch(/proxy/i);
    expect(l.title).not.toMatch(/not supported/i);
  });

  test('with a proxy configured it blames the fetch, not the architecture', () => {
    // Once a proxy is running, "in-headset rendering is not supported" is
    // simply false — rendering works; this page just could not be fetched.
    const l = contentStateLines('unavailable', 'https://example.com/a', true);
    expect(l.detail).toMatch(/proxy could not fetch/i);
    expect(l.detail).not.toMatch(/CORS/i);
  });

  test('the two proxy states give genuinely different guidance', () => {
    const withOut = contentStateLines('unavailable', 'https://e.com/', false);
    const withP = contentStateLines('unavailable', 'https://e.com/', true);
    expect(withOut.title).not.toBe(withP.title);
    expect(withOut.detail).not.toBe(withP.detail);
  });

  test('an unparseable url degrades without throwing', () => {
    expect(() => contentStateLines('unavailable', 'not a url')).not.toThrow();
    expect(contentStateLines('unavailable', '').detail).toMatch(/CORS/i);
  });
});

describe('securityIndicator — meaning carried by glyph, not colour alone (WCAG 1.4.1)', () => {
  test('each level has a distinct glyph', () => {
    const glyphs = ['secure', 'insecure', 'local'].map((l) => securityIndicator(l).glyph);
    expect(new Set(glyphs).size).toBe(3);
    expect(glyphs.every((g) => g.length > 0)).toBe(true);
  });

  test('none has no glyph', () => {
    expect(securityIndicator('none').glyph).toBe('');
  });

  test('high contrast changes colour but keeps the glyph', () => {
    const normal = securityIndicator('insecure', false);
    const hc = securityIndicator('insecure', true);
    expect(hc.glyph).toBe(normal.glyph);
    expect(hc.color).not.toBe(normal.color);
  });
});

// ── Reader fetch routing (Session 74, the "add back 10%") ───────────────────
// Measured: no general site sends Access-Control-Allow-Origin on its HTML
// (Wikipedia, MDN, example.com, NHK — 4 of 4 send none), so a browser-side
// reader cannot fetch pages directly. The optional companion proxy closes
// that; without it the behaviour is exactly what shipped before.
describe('readerFetchUrl', () => {
  const { readerFetchUrl } = require('../src/vr/browser/urlDisplay.js');

  test('with no proxy configured it fetches the target directly (unchanged)', () => {
    expect(readerFetchUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(readerFetchUrl('https://example.com/a', '')).toBe('https://example.com/a');
    expect(readerFetchUrl('https://example.com/a', '   ')).toBe('https://example.com/a');
  });

  test('with a proxy it routes through /fetch with the target encoded', () => {
    expect(readerFetchUrl('https://example.com/a?b=1&c=2', 'http://127.0.0.1:8080'))
      .toBe('http://127.0.0.1:8080/fetch?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1%26c%3D2');
  });

  test('query characters in the target cannot break out of the parameter', () => {
    // A target containing & or # must not become extra proxy parameters.
    const out = readerFetchUrl('https://x.test/?a=1&b=2#frag', 'http://p:8080');
    expect(out.split('?').length).toBe(2);
    expect(out).not.toContain('#');
    expect(decodeURIComponent(out.split('url=')[1])).toBe('https://x.test/?a=1&b=2#frag');
  });

  test('a trailing slash on the proxy base does not double up', () => {
    expect(readerFetchUrl('https://e.com/', 'http://p:8080/'))
      .toBe(readerFetchUrl('https://e.com/', 'http://p:8080'));
    expect(readerFetchUrl('https://e.com/', 'http://p:8080///')).not.toContain('////fetch');
  });

  test('degenerate input does not throw', () => {
    for (const [t, p] of [[null, null], [undefined, undefined], ['', ''], [42, 7]]) {
      expect(() => readerFetchUrl(t, p)).not.toThrow();
    }
  });
});
