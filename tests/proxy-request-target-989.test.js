/**
 * Round 989 pin: the inbound request-target is client-controlled bytes too.
 *
 * `createProxyServer`'s async handler runs `new URL(req.url, …)` bare — but a
 * request-target that is legal per HTTP (`//` and friends pass llhttp's
 * origin-form check: anything starting with '/') can still fail WHATWG URL
 * parsing (an empty authority is invalid for a special scheme). The throw
 * rejects the async handler: the socket never answers, and under Node's
 * default unhandled-rejection=throw policy the whole proxy process dies —
 * one unauthenticated request is a remote kill. Same class as the redirect
 * Location parse guarded in round 955.
 */
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('node:http');
const { spawn } = require('child_process');

jest.setTimeout(30_000);

const SRC = fs.readFileSync(path.join(__dirname, '..', 'proxy', 'server.js'), 'utf8');
const SERVER = path.join(__dirname, '..', 'proxy', 'server.js');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

function rawGet(port, requestPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: requestPath, method: 'GET', agent: false }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => {
      req.destroy(new Error('request timed out'));
    });
    req.end();
  });
}

async function waitForReady(proc, port) {
  const deadline = Date.now() + 25_000;
  for (;;) {
    if (proc.exitCode !== null) {
      throw new Error(`proxy exited during startup (${proc.exitCode})`);
    }
    try {
      const res = await rawGet(port, '/health');
      if (res.statusCode === 200) {
        return;
      }
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      throw new Error('proxy did not start');
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe('malformed request-target (live server)', () => {
  let proc;
  let port;

  beforeAll(async () => {
    port = await freePort();
    proc = spawn(process.execPath, [SERVER], {
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitForReady(proc, port);
  });

  afterAll(() => {
    if (proc) {
      proc.kill();
    }
  });

  test.each(['//', '//[]', '//[::1', '//%'])('GET %j answers 400, not a dead socket', async (p) => {
    const res = await rawGet(port, p);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('malformed-request-target');
  });

  test('the process survives — /health still answers afterwards', async () => {
    const res = await rawGet(port, '/health');
    expect(res.statusCode).toBe(200);
  });
});

describe('the request-target parse is guarded in source', () => {
  test('req.url is parsed through a guarded helper, never bare new URL', () => {
    expect(SRC).not.toMatch(/= new URL\(req\.url/);
    expect(SRC).toMatch(/function parseRequestTarget\(/);
    expect(SRC).toMatch(/parseRequestTarget\(req\.url\)/);
    expect(SRC).toContain('malformed-request-target');
  });
});
