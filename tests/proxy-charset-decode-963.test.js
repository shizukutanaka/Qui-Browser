/**
 * Round 963 pin: the proxy must decode the upstream body by the response's
 * declared charset, not unconditionally as UTF-8.
 *
 * `fetchThroughGuard` collected the body with `.toString('utf8')` — honest for
 * the UTF-8 web but mojibake (U+FFFD) for pages served as Shift_JIS / EUC-JP,
 * still common on the Japanese web this product targets. The proxy claimed to
 * let the reader "read the real web"; it only read the UTF-8 web honestly.
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

const JP = '日本語';
const SHIFT_JIS = Buffer.from([147, 250, 150, 123, 140, 234]);
const EUC_JP = Buffer.from([198, 252, 203, 220, 184, 236]);
const UTF8 = Buffer.from(JP, 'utf8');

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

async function fetchBody(contentType, body) {
  lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  httpRequest.mockImplementation(fakeRequest({ statusCode: 200, headers: { 'content-type': contentType }, body }));
  const out = await fetchThroughGuard('http://example.com/');
  expect(out.ok).toBe(true);
  return out.body;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('upstream body decoding honours the declared charset', () => {
  test('Shift_JIS page decodes to Japanese text, not U+FFFD mojibake', async () => {
    const body = await fetchBody('text/html; charset=shift_jis', SHIFT_JIS);
    expect(body).toContain(JP);
    expect(body).not.toContain('�');
  });

  test('EUC-JP page decodes to Japanese text', async () => {
    const body = await fetchBody('text/html; charset=euc-jp', EUC_JP);
    expect(body).toContain(JP);
  });

  test('uppercase charset name + quoted value still resolves the encoding', async () => {
    const body = await fetchBody('text/html; CHARSET="Shift_JIS"', SHIFT_JIS);
    expect(body).toContain(JP);
  });

  test('missing charset keeps the UTF-8 default', async () => {
    const body = await fetchBody('text/html', UTF8);
    expect(body).toContain(JP);
  });

  test('explicit charset=utf-8 decodes as before', async () => {
    const body = await fetchBody('text/html; charset=utf-8', UTF8);
    expect(body).toContain(JP);
  });

  test('unsupported charset label falls back to UTF-8 instead of throwing', async () => {
    const body = await fetchBody('text/html; charset=x-not-a-real-encoding-99', UTF8);
    expect(body).toContain(JP);
  });
});

describe('source pins', () => {
  test('server.js no longer decodes the upstream body as unconditional utf8', () => {
    expect(SRC).not.toMatch(/toString\('utf8'\)/);
  });
});
