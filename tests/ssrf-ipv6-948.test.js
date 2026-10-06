/**
 * IPv6 canonicalization holes in the SSRF guard.
 *
 * The guard's IPv6 branch only matched the exact strings '::1' / '::' and a
 * dotted-decimal ::ffff:a.b.c.d regex. Every other spelling of an embedded or
 * loopback address — hex pairs, expanded forms, other transition prefixes —
 * passed BOTH the literal-IP check and the post-resolution check, and Node
 * connects them to the real private target. `http://[::ffff:a9fe:a9fe]/…`
 * reached the cloud metadata service with no DNS involved at all.
 *
 * These tests pin the fix: IPv6 addresses are parsed into their 16 bytes and
 * classified structurally, not string-matched. Public forms (a mapped public
 * v4, a real public v6) must stay allowed — a guard that blocks everything
 * just pushes users to turn it off.
 */

const { isBlockedAddress, assertRequestAllowed } = require('../proxy/ssrfGuard.js');

describe('IPv4-embedded IPv6 in non-dotted notation', () => {
  test.each([
    // ::ffff:<v4> written as hex pairs instead of dotted decimal
    '::ffff:7f00:1', // 127.0.0.1
    '::ffff:a9fe:a9fe', // 169.254.169.254 — cloud metadata
    '::ffff:c0a8:101', // 192.168.1.1
    '::ffff:0a00:1', // 10.0.0.1
    // expanded spellings of the same mapped forms
    '0:0:0:0:0:ffff:7f00:1',
    // deprecated IPv4-compatible ::/96 carrying a private address
    '::7f00:1',
    '::a9fe:a9fe',
    // NAT64 well-known prefix 64:ff9b::/96 with private embedded v4
    '64:ff9b::a9fe:a9fe',
    '64:ff9b::7f00:1',
    '64:ff9b::169.254.169.254',
    // 6to4 2002::/16 embeds the IPv4 in the next 32 bits
    '2002:a9fe:a9fe::',
    '2002:7f00:1::'
  ])('%s is blocked — established mapped-private reason', (addr) => {
    expect(isBlockedAddress(addr)).toEqual({ blocked: true, reason: 'ipv4-mapped-private' });
  });

  test.each([
    // public embedded addresses stay reachable — dotted AND hex notation
    '::ffff:8.8.8.8',
    '::ffff:0808:0808',
    '64:ff9b::0808:0808',
    '2002:0808:0808::',
    // real public IPv6
    '2001:4860:4860::8888',
    '2606:4700:4700::1111'
  ])('%s is a public address and stays allowed', (addr) => {
    expect(isBlockedAddress(addr).blocked).toBe(false);
  });
});

describe('IPv6 loopback/unspecified in expanded spelling', () => {
  test.each([
    '0:0:0:0:0:0:0:1', // loopback
    '0000:0000:0000:0000:0000:0000:0000:0001',
    '0:0:0:0:0:0:0:0', // unspecified
    '0000:0000:0000:0000:0000:0000:0000:0000'
  ])('%s is blocked', (addr) => {
    expect(isBlockedAddress(addr).blocked).toBe(true);
  });
});

describe('IPv6 site-local and multicast', () => {
  test.each([
    ['fec0::1', 'deprecated site-local (fec0::/10)'],
    ['ff02::1', 'link-local multicast'],
    ['ff05::2', 'site-local multicast']
  ])('%s is blocked — %s', (addr) => {
    expect(isBlockedAddress(addr).blocked).toBe(true);
  });
});

describe('end-to-end via assertRequestAllowed (WHATWG-normalized hostname)', () => {
  test.each([
    'http://[::ffff:a9fe:a9fe]/latest/meta-data',
    'http://[0:0:0:0:0:ffff:c0a8:101]/admin',
    'http://[::7f00:1]/'
  ])('%s is refused', (target) => {
    const r = assertRequestAllowed(target);
    expect(r.ok).toBe(false);
  });

  test('malformed IPv6-ish strings never reach a socket', () => {
    expect(isBlockedAddress('::ffff::1').blocked).toBe(true);
    expect(isBlockedAddress('::::').blocked).toBe(true);
  });
});
