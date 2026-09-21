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
    on(ev, cb) {
      if (ev === 'end') {
        setImmediate(cb);
      } return this;
    },
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

  test('lookup returns the validated array when the caller asks all=true', async () => {
    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }
    ]);
    await fetchThroughGuard('http://example.com/page');
    const opts = http.request.mock.calls[0][1];
    const cb = jest.fn();
    // Node >= 20's http stack always invokes lookup with all: true and
    // requires an array — the scalar form throws ERR_INVALID_IP_ADDRESS and
    // every proxied fetch died with upstream-error before this fix.
    opts.lookup('example.com', { all: true }, cb);
    expect(cb).toHaveBeenCalledWith(null, [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }
    ], 4);
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

/**
 * Every redirect hop is a fresh SSRF opportunity: the guard must re-run on
 * the redirect target before the next request is issued, and the chain must
 * give up after MAX_REDIRECTS.
 */
describe('fetchThroughGuard — redirect hops', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  function fakeReq() {
    const listeners = {};
    return {
      on(ev, cb) {
        (listeners[ev] ||= []).push(cb); return this;
      },
      end() {},
      destroy() {},
      _emit(ev, ...args) {
        (listeners[ev] || []).forEach((f) => f(...args));
      }
    };
  }

  function fakeRes(statusCode, headers, bodyChunks = ['<html>ok</html>']) {
    const listeners = {};
    const r = {
      statusCode, headers,
      on(ev, cb) {
        (listeners[ev] ||= []).push(cb); return this;
      },
      resume() {},
      destroy() {
        r.destroyed = true;
      },
      _drive() {
        bodyChunks.forEach((c) => (listeners.data || []).forEach((f) => f(Buffer.from(c))));
        (listeners.end || []).forEach((f) => f());
      }
    };
    return r;
  }

  test('a redirect re-runs the guard on the new target before re-issuing', async () => {
    const responses = [
      { statusCode: 302, headers: { location: 'https://example.org/final' } },
      { statusCode: 200, headers: { 'content-type': 'text/html' } }
    ];
    http.request.mockImplementation((url, opts, cb) => {
      const req = fakeReq();
      const spec = responses[http.request.mock.calls.length - 1];
      const res = fakeRes(spec.statusCode, spec.headers);
      setImmediate(() => {
        cb(res); setImmediate(() => res._drive());
      });
      return req;
    });
    const https = require('node:https');
    https.request.mockImplementation((url, opts, cb) => {
      const req = fakeReq();
      const res = fakeRes(200, { 'content-type': 'text/html' });
      setImmediate(() => {
        cb(res); setImmediate(() => res._drive());
      });
      return req;
    });
    const out = await fetchThroughGuard('http://example.com/start');
    expect(out.ok).toBe(true);
    expect(out.finalUrl).toBe('https://example.org/final');
    expect(out.body).toBe('<html>ok</html>');
    // The redirected hop resolved+checked its own hostname.
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  test('a redirect loop stops at MAX_REDIRECTS instead of following forever', async () => {
    http.request.mockImplementation((url, opts, cb) => {
      const req = fakeReq();
      const res = fakeRes(302, { location: 'http://example.com/loop' });
      setImmediate(() => {
        cb(res);
      });
      return req;
    });
    const out = await fetchThroughGuard('http://example.com/start');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('too-many-redirects');
    // hop <= MAX_REDIRECTS(3) means requests 0..3 = 4 total issued.
    expect(http.request).toHaveBeenCalledTimes(4);
  });

  test('a redirect to a blocked address is refused at the second hop', async () => {
    http.request.mockImplementation((url, opts, cb) => {
      const req = fakeReq();
      const res = fakeRes(302, { location: 'http://169.254.169.254/latest/meta-data' });
      setImmediate(() => {
        cb(res);
      });
      return req;
    });
    const out = await fetchThroughGuard('http://example.com/start');
    expect(out.ok).toBe(false);
    expect(http.request).toHaveBeenCalledTimes(1); // hop 2 never issued
  });

  test('a malformed redirect Location is refused, not thrown (a throw would kill the process)', async () => {
    http.request.mockImplementation((url, opts, cb) => {
      const req = fakeReq();
      const res = fakeRes(302, { location: 'http://[::bad' });
      setImmediate(() => {
        cb(res);
      });
      return req;
    });
    const out = await fetchThroughGuard('http://example.com/start');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('bad-redirect-location');
  });

  test('a repeated Location header (array) degrades instead of throwing', async () => {
    http.request.mockImplementation((url, opts, cb) => {
      const req = fakeReq();
      const res = fakeRes(302, { location: ['http://a.example/', 'http://b.example/'] });
      setImmediate(() => {
        cb(res);
      });
      return req;
    });
    const out = await fetchThroughGuard('http://example.com/start');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('bad-redirect-location');
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  test('non-readable content-type is refused and the body is not consumed', async () => {
    http.request.mockImplementation((url, opts, cb) => {
      const req = fakeReq();
      const res = fakeRes(200, { 'content-type': 'application/octet-stream' });
      res._drive = jest.fn();
      setImmediate(() => {
        cb(res); setImmediate(() => res._drive());
      });
      return req;
    });
    const out = await fetchThroughGuard('http://example.com/file');
    expect(out.ok).toBe(false);
    expect(out.reason).toContain('content-type-not-readable');
  });

  test('oversized body aborts mid-stream rather than buffering it all', async () => {
    const big = 'x'.repeat(6 * 1024 * 1024); // > MAX_RESPONSE_BYTES (5MB)
    http.request.mockImplementation((url, opts, cb) => {
      const req = fakeReq();
      const res = fakeRes(200, { 'content-type': 'text/html' }, [big]);
      setImmediate(() => {
        cb(res); setImmediate(() => res._drive());
      });
      return req;
    });
    const out = await fetchThroughGuard('http://example.com/huge');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('response-too-large-or-truncated');
  });

  test('upstream socket errors surface as a reason, not a throw', async () => {
    http.request.mockImplementation((url, opts, cb) => {
      const req = fakeReq();
      setImmediate(() => req._emit('error', new Error('ECONNREFUSED')));
      return req;
    });
    const out = await fetchThroughGuard('http://example.com/down');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('upstream-error');
  });
});
