/**
 * createProxyServer dispatch arms — driven over real HTTP on an ephemeral
 * port (no mocks; the server is plain node:http). Successful /fetch is the
 * one arm not exercised here: it would need a live upstream, and any local
 * upstream is refused by the guard by design.
 */
const http = require('http');
const { createProxyServer } = require('../proxy/server.js');

let server;
let base;
beforeAll(async () => {
  server = createProxyServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => server.close());

function req(path, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request(base + path, { method, headers }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    r.on('error', reject);
    r.end();
  });
}

describe('dispatch arms', () => {
  test('OPTIONS preflight → 204 with CORS headers', async () => {
    const res = await req('/fetch?url=https://x', { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toBe('GET, OPTIONS');
  });

  test('non-GET non-OPTIONS → 405', async () => {
    const res = await req('/fetch?url=https://x', { method: 'POST' });
    expect(res.status).toBe(405);
    expect(JSON.parse(res.body).error).toBe('method-not-allowed');
  });

  test('/health → 200 ok', async () => {
    const res = await req('/health');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
  });

  test('unknown path → 404', async () => {
    const res = await req('/anything-else');
    expect(res.status).toBe(404);
  });

  test('GET /fetch without url → 400 missing-url', async () => {
    const res = await req('/fetch');
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('missing-url');
  });

  test('blocked target → 400 with a reason that leaks nothing internal', async () => {
    const res = await req('/fetch?url=' + encodeURIComponent('http://127.0.0.1:8080/admin'));
    expect(res.status).toBe(400);
    const reason = JSON.parse(res.body).error;
    expect(reason).toMatch(/blocked|private|loopback|:/);
    // The reason string must not echo the resolved address or any internal detail.
    expect(reason).not.toContain('127.0.0.1');
  });

  test('non-http(s) scheme refused before any socket opens', async () => {
    const res = await req('/fetch?url=' + encodeURIComponent('file:///etc/passwd'));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/scheme|protocol|:/);
  });

  test('every response carries CORS headers even on errors', async () => {
    const res = await req('/nope');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
