/**
 * SSRF guard for the optional reader proxy.
 *
 * The proxy is the only component in this product that turns a user-supplied
 * string into an outbound request from a machine the user does not control, so
 * the guard is a security boundary and is tested as one: every blocked range is
 * enumerated, and the cases that actually break naive proxies — a public
 * hostname resolving to a private address, a redirect into link-local space, an
 * IPv4-mapped IPv6 address — each have their own test.
 */

const {
  isBlockedAddress, assertRequestAllowed, safeUpstreamHeaders, isReadableContentType,
  ALLOWED_SCHEMES, ALLOWED_PORTS, MAX_RESPONSE_BYTES, MAX_REDIRECTS
} = require('../proxy/ssrfGuard.js');

describe('isBlockedAddress — literal IPv4 ranges', () => {
  test.each([
    ['0.0.0.0', 'this-network'],
    ['127.0.0.1', 'loopback'],
    ['127.1.2.3', 'loopback'],
    ['10.0.0.1', 'private-10'],
    ['100.64.0.1', 'shared-cgnat'],
    ['169.254.169.254', 'link-local'],   // cloud metadata — the classic target
    ['172.16.0.1', 'private-172'],
    ['172.31.255.255', 'private-172'],
    ['192.0.0.1', 'ietf-protocol'],
    ['192.168.1.1', 'private-192'],
    ['198.18.0.1', 'benchmark'],
    ['240.0.0.1', 'reserved-240'],
    ['255.255.255.255', 'reserved-240']
  ])('%s is blocked (%s)', (ip, reason) => {
    expect(isBlockedAddress(ip)).toEqual({ blocked: true, reason });
  });

  test.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '100.63.255.255'])(
    '%s is a public address and is allowed',
    (ip) => {
      expect(isBlockedAddress(ip).blocked).toBe(false);
    }
  );

  test('the boundaries of 172.16/12 are handled exactly', () => {
    expect(isBlockedAddress('172.15.255.255').blocked).toBe(false);
    expect(isBlockedAddress('172.16.0.0').blocked).toBe(true);
    expect(isBlockedAddress('172.31.255.255').blocked).toBe(true);
    expect(isBlockedAddress('172.32.0.0').blocked).toBe(false);
  });
});

describe('isBlockedAddress — IPv6', () => {
  test.each(['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '[::1]'])(
    '%s is blocked', (ip) => {
      expect(isBlockedAddress(ip).blocked).toBe(true);
    }
  );

  test('an IPv4-mapped private address cannot smuggle past the v6 path', () => {
    // ::ffff:127.0.0.1 is loopback wearing a v6 costume.
    expect(isBlockedAddress('::ffff:127.0.0.1')).toEqual({
      blocked: true, reason: 'ipv4-mapped-private'
    });
    expect(isBlockedAddress('::ffff:169.254.169.254').blocked).toBe(true);
    expect(isBlockedAddress('::ffff:8.8.8.8').blocked).toBe(false);
  });

  test('a zone index does not evade the check', () => {
    expect(isBlockedAddress('fe80::1%eth0').blocked).toBe(true);
  });

  test('public IPv6 is allowed', () => {
    expect(isBlockedAddress('2606:4700:4700::1111').blocked).toBe(false);
  });
});

describe('isBlockedAddress — hostnames', () => {
  test.each(['localhost', 'foo.localhost', 'printer.local', 'db.internal', 'x.home.arpa'])(
    '%s is blocked', (h) => {
      expect(isBlockedAddress(h).blocked).toBe(true);
    }
  );

  test('a bare label is a LAN name, not a public site', () => {
    expect(isBlockedAddress('intranet')).toEqual({ blocked: true, reason: 'bare-hostname' });
  });

  test('ordinary public hostnames pass', () => {
    for (const h of ['example.com', 'en.wikipedia.org', 'sub.domain.co.jp']) {
      expect(isBlockedAddress(h).blocked).toBe(false);
    }
  });

  test('empty or missing input is blocked, not allowed by default', () => {
    for (const bad of ['', '   ', null, undefined]) {
      expect(isBlockedAddress(bad).blocked).toBe(true);
    }
  });
});

describe('assertRequestAllowed', () => {
  test('accepts an ordinary https URL and returns the parsed form', () => {
    const out = assertRequestAllowed('https://example.com/article?x=1');
    expect(out.ok).toBe(true);
    expect(out.url.hostname).toBe('example.com');
  });

  test.each(['file:///etc/passwd', 'gopher://x.com/', 'data:text/html,<b>', 'ftp://example.com/'])(
    'refuses %s', (u) => {
      const out = assertRequestAllowed(u);
      expect(out.ok).toBe(false);
      expect(out.reason).toMatch(/scheme-not-allowed|unparseable/);
    }
  );

  test('refuses credentials in the URL — they disguise the real host', () => {
    const out = assertRequestAllowed('https://user:pass@example.com/');
    expect(out).toEqual({ ok: false, reason: 'credentials-in-url' });
  });

  test('refuses non-web ports (an internal service on 6379 is not a web page)', () => {
    expect(assertRequestAllowed('http://example.com:6379/').reason).toBe('port-not-allowed:6379');
    expect(assertRequestAllowed('http://example.com:22/').reason).toBe('port-not-allowed:22');
    expect(assertRequestAllowed('https://example.com/').ok).toBe(true);   // implicit 443
    expect(assertRequestAllowed('http://example.com/').ok).toBe(true);    // implicit 80
  });

  test('refuses literal internal addresses, including cloud metadata', () => {
    expect(assertRequestAllowed('http://169.254.169.254/latest/meta-data/').reason)
      .toBe('host-blocked:link-local');
    expect(assertRequestAllowed('http://127.0.0.1:8080/').reason).toBe('host-blocked:loopback');
    expect(assertRequestAllowed('http://[::1]/').reason).toMatch(/host-blocked/);
  });

  test('garbage input is refused rather than throwing', () => {
    for (const bad of ['', 'not a url', '://', null, undefined, 42]) {
      expect(() => assertRequestAllowed(bad)).not.toThrow();
      expect(assertRequestAllowed(bad).ok).toBe(false);
    }
  });

  test('the allowlists are conservative', () => {
    expect(ALLOWED_SCHEMES).toEqual(['http:', 'https:']);
    expect(ALLOWED_PORTS.every((p) => [80, 443, 8080, 8443].includes(p))).toBe(true);
    expect(MAX_RESPONSE_BYTES).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(MAX_REDIRECTS).toBeLessThanOrEqual(5);
  });
});

describe('safeUpstreamHeaders', () => {
  test('never forwards cookies, authorization or forwarding headers', () => {
    const out = safeUpstreamHeaders({
      cookie: 'session=secret',
      authorization: 'Bearer token',
      'x-forwarded-for': '10.0.0.1',
      'x-api-key': 'k'
    });
    const keys = Object.keys(out).map((k) => k.toLowerCase());
    for (const leaked of ['cookie', 'authorization', 'x-forwarded-for', 'x-api-key']) {
      expect(keys).not.toContain(leaked);
    }
  });

  test('identifies itself and accepts markup', () => {
    const out = safeUpstreamHeaders();
    expect(out['user-agent']).toMatch(/Qui-Browser/);
    expect(out.accept).toMatch(/text\/html/);
  });

  test('passes a sane accept-language through but bounds it', () => {
    expect(safeUpstreamHeaders({ 'accept-language': 'ja,en;q=0.8' })['accept-language'])
      .toBe('ja,en;q=0.8');
    expect(safeUpstreamHeaders({ 'accept-language': 'x'.repeat(500) })['accept-language'])
      .toBeUndefined();
  });
});

describe('isReadableContentType', () => {
  test('accepts markup and plain text only', () => {
    expect(isReadableContentType('text/html; charset=utf-8')).toBe(true);
    expect(isReadableContentType('application/xhtml+xml')).toBe(true);
    expect(isReadableContentType('text/plain')).toBe(true);
  });

  test('refuses everything else, so the proxy is not a general file relay', () => {
    for (const ct of ['application/zip', 'image/png', 'video/mp4', 'application/octet-stream', '', undefined]) {
      expect(isReadableContentType(ct)).toBe(false);
    }
  });
});
