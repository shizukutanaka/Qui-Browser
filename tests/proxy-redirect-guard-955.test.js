/**
 * Round 955 pin: a redirect hop's Location header is upstream-controlled
 * bytes and must be parsed behind the same guard the initial target gets.
 *
 * `assertRequestAllowed` wraps `new URL` in try/catch for hop 0, but the
 * redirect hop called `new URL(r.headers.location, url)` bare — a malformed
 * Location throws TypeError, which rejects fetchThroughGuard inside the
 * async request handler: the socket never answers, and under Node's default
 * unhandled-rejection=throw mode the whole proxy process dies.
 */
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'proxy', 'server.js'), 'utf8');

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('node:http', () => ({ request: jest.fn(), createServer: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));

const { lookup } = require('node:dns/promises');
const { request: httpRequest } = require('node:http');
const { fetchThroughGuard } = require('../proxy/server.js');

function fakeRequest(script) {
  return (url, opts, cb) => {
    const req = new EventEmitter();
    req.destroy = () => {};
    req.end = () => {
      const res = new EventEmitter();
      res.statusCode = script.statusCode;
      res.headers = script.headers || {};
      res.resume = () => {};
      setImmediate(() => cb(res));
      setImmediate(() => {
        if (script.body) {
          res.emit('data', Buffer.from(script.body));
        }
        res.emit('end');
      });
    };
    return req;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('malformed redirect Location', () => {
  test.each(['http://[', 'https://', 'http://foo bar/baz', 'http://exa[mple.com/'])(
    '%j resolves to a guard failure, not a rejection',
    async (location) => {
      lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      httpRequest.mockImplementation(fakeRequest({ statusCode: 301, headers: { location } }));
      const out = await fetchThroughGuard('http://example.com/');
      expect(out.ok).toBe(false);
      expect(out.reason).toBe('invalid-redirect-location');
    }
  );

  test('a valid Location still hops and re-runs the guard', async () => {
    lookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '93.184.216.35', family: 4 }]);
    httpRequest
      .mockImplementationOnce(fakeRequest({ statusCode: 301, headers: { location: '/next' } }))
      .mockImplementationOnce(fakeRequest({ statusCode: 200, headers: { 'content-type': 'text/plain' }, body: 'ok' }));
    const out = await fetchThroughGuard('http://example.com/');
    expect(out.ok).toBe(true);
    expect(httpRequest).toHaveBeenCalledTimes(2);
  });
});

describe('the redirect hop is guarded in source', () => {
  test('Location is parsed through a guarded helper, never bare new URL', () => {
    expect(SRC).not.toMatch(/new URL\(r\.headers\.location/);
    expect(SRC).toMatch(/function redirectTarget\(location, base\)/);
    expect(SRC).toMatch(/redirectTarget\(r\.headers\.location, url\)/);
  });
});
