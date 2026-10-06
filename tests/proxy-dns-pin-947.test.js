/**
 * Class pin (proxy SSRF): the guard resolves the hostname and checks EVERY
 * returned address — the socket must then be pinned to that validated
 * address. If the connect re-resolves the hostname, a DNS answer that changes
 * between lookups (rebinding: first answer public, second answer private)
 * routes the socket around the guard entirely.
 *
 * The fix shape is a `lookup` option on the request: Node consults it instead
 * of the real resolver at connect time, and the URL keeps its hostname so
 * TLS SNI / certificate identity / the Host header are unchanged.
 */

const { EventEmitter } = require('events');

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('node:http', () => ({ request: jest.fn(), createServer: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));

const { lookup } = require('node:dns/promises');
const { request: httpRequest } = require('node:http');
const { request: httpsRequest } = require('node:https');
const { fetchThroughGuard } = require('../proxy/server.js');

const PUBLIC_IP = '93.184.216.34';

// Minimal ClientRequest double: emits a scripted response after .end().
function fakeRequest(captured, script) {
  return (url, opts, cb) => {
    captured.push({ url, opts });
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

describe('fetchThroughGuard DNS pinning', () => {
  test('the socket is pinned to the address the guard validated', async () => {
    lookup.mockResolvedValue([{ address: PUBLIC_IP, family: 4 }]);
    const captured = [];
    httpsRequest.mockImplementation(
      fakeRequest(captured, { statusCode: 200, headers: { 'content-type': 'text/html' }, body: 'ok' })
    );

    const out = await fetchThroughGuard('https://example.com/article');
    expect(out.ok).toBe(true);
    expect(captured).toHaveLength(1);

    // The request MUST carry a lookup pinning the connect to the validated
    // address — without it the connect performs a second, unchecked lookup.
    const pin = captured[0].opts.lookup;
    expect(typeof pin).toBe('function');
    const cb = jest.fn();
    pin('example.com', {}, cb);
    expect(cb).toHaveBeenCalledWith(null, PUBLIC_IP, 4);

    // DNS was consulted exactly once — inside the guard, not again at connect.
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  test('pinning preserves hostname identity — SNI, cert check, Host header', async () => {
    lookup.mockResolvedValue([{ address: PUBLIC_IP, family: 4 }]);
    const captured = [];
    httpsRequest.mockImplementation(
      fakeRequest(captured, { statusCode: 200, headers: { 'content-type': 'text/html' }, body: 'ok' })
    );

    await fetchThroughGuard('https://example.com/article');

    // The URL still carries the real hostname, so TLS SNI and certificate
    // validation are unaffected by the pinned address.
    expect(captured[0].url.hostname).toBe('example.com');
    expect(captured[0].opts.headers.host).toBe('example.com');
  });

  test.each([
    { address: PUBLIC_IP, family: 4 },
    { address: '2606:4700:4700::1111', family: 6 }
  ])('pinning supports both lookup callback forms for IPv$family', async (address) => {
    lookup.mockResolvedValue([address]);
    const captured = [];
    httpsRequest.mockImplementation(
      fakeRequest(captured, { statusCode: 200, headers: { 'content-type': 'text/html' }, body: 'ok' })
    );

    expect((await fetchThroughGuard('https://example.com/article')).ok).toBe(true);
    const pin = captured[0].opts.lookup;
    const cb = jest.fn();
    pin('example.com', { all: true }, cb);
    expect(cb).toHaveBeenCalledWith(null, [address]);
    cb.mockClear();
    pin('example.com', { all: false }, cb);
    expect(cb).toHaveBeenCalledWith(null, address.address, address.family);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  test('every redirect hop pins its own freshly-validated address', async () => {
    const SECOND_IP = '93.184.216.35';
    lookup
      .mockResolvedValueOnce([{ address: PUBLIC_IP, family: 4 }])
      .mockResolvedValueOnce([{ address: SECOND_IP, family: 4 }]);

    const captured = [];
    httpRequest
      .mockImplementationOnce(fakeRequest(captured, { statusCode: 301, headers: { location: '/next' } }))
      .mockImplementationOnce(
        fakeRequest(captured, { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: 'ok' })
      );

    const out = await fetchThroughGuard('http://example.com/');
    expect(out.ok).toBe(true);
    expect(captured).toHaveLength(2);

    for (const [i, expected] of [PUBLIC_IP, SECOND_IP].entries()) {
      const pin = captured[i].opts.lookup;
      expect(typeof pin).toBe('function');
      const cb = jest.fn();
      pin('example.com', {}, cb);
      expect(cb).toHaveBeenCalledWith(null, expected, 4);
    }
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});
