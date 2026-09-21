/**
 * The proxy's DNS-pin lookup must satisfy Node's real lookup contract.
 *
 * fetchThroughGuard pins each upstream connection to the DNS answers the SSRF
 * guard already validated. On Node >= 20, http.request invokes that lookup
 * with { all: true } and requires an ARRAY of {address, family} — our original
 * scalar callback threw ERR_INVALID_IP_ADDRESS and every /fetch returned
 * `upstream-error` while unit tests (which mock node:http) stayed green.
 *
 * This test uses a REAL local HTTP server + REAL http.request — no mocks —
 * pinning the transport contract itself. (The SSRF guard correctly blocks
 * loopback targets, so fetchThroughGuard can't be driven end-to-end here;
 * the mocked proxy-server suite pins the callback shape.)
 */
import { createServer, request } from 'node:http';

describe('lookup contract against a real socket', () => {
  test('a pinned array-form lookup completes a real request', async () => {
    const server = createServer((req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end('<html>ok</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address();
    try {
      const res = await new Promise((resolve, reject) => {
        // Same shape fetchThroughGuard's lookup returns when Node asks
        // all:true — driven through the real transport, not a mock.
        const req = request({
          host: 'example.invalid',
          port,
          path: '/',
          lookup: (_h, opts, cb) =>
            cb(null, opts.all ? [{ address: '127.0.0.1', family: 4 }] : '127.0.0.1', 4)
        }, resolve);
        req.on('error', reject);
        req.end();
      });
      expect(res.statusCode).toBe(200);
      res.resume();
    } finally {
      server.close();
    }
  });
});
