/**
 * proxy/server.js — the socket must connect to the *checked* address.
 *
 * The DNS rebinding hole: resolveSafely() validates the A records, but
 * httpRequest(url) re-resolves the hostname at connect time — attacker DNS
 * with TTL=0 (or different answers per query) returns a private address on
 * the second lookup and the guard is bypassed. The fix is pinning the
 * connection via a `lookup` option that replays the already-checked answer.
 */

jest.mock('node:http', () => ({ request: jest.fn(), createServer: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));
jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));

const http = require('node:http');
const { lookup } = require('node:dns/promises');
const { fetchThroughGuard } = require('../proxy/server.js');

function fakeResponse() {
  return {
    statusCode: 200,
    headers: { 'content-type': 'text/html' },
    on(ev, cb) { if (ev === 'end') setImmediate(cb); return this; },
    resume() {},
    destroy() {}
  };
}

describe('fetchThroughGuard — DNS pinning (TOCTOU)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    http.request.mockImplementation((url, opts, cb) => {
      setImmediate(() => cb(fakeResponse()));
      return { on() {}, end() {}, destroy() {} };
    });
  });

  test('connect() uses the checked address via a pinned lookup, not a re-resolve', async () => {
    await fetchThroughGuard('http://example.com/page');
    expect(http.request).toHaveBeenCalledTimes(1);
    const opts = http.request.mock.calls[0][1];
    expect(typeof opts.lookup).toBe('function');
    const cb = jest.fn();
    opts.lookup('example.com', {}, cb);
    // The pinned lookup must answer the resolved address, not re-query DNS.
    expect(cb).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  });

  test('all resolved addresses are checked before any socket opens', async () => {
    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 }
    ]);
    const out = await fetchThroughGuard('http://example.com/page');
    expect(out.ok).toBe(false);
    expect(http.request).not.toHaveBeenCalled();
  });
});
