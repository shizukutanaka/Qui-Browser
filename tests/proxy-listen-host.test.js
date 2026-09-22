/**
 * proxy/server.js — the reader proxy must not become an open relay on the LAN.
 *
 * `server.listen(PORT)` with no host argument binds the wildcard address
 * (::/0.0.0.0 — every network interface). The startup log tells the user
 * the proxy is on http://127.0.0.1:PORT, but every LAN peer could actually
 * reach it: an open fetch relay for arbitrary URLs that other devices on
 * the network can route through. The bind must be explicit: loopback by
 * default, wildcard only when the operator sets HOST.
 */

const fs = require('node:fs');
const path = require('node:path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'proxy', 'server.js'), 'utf8');

describe('proxy listen host', () => {
  test('LISTEN_HOST defaults to loopback', () => {
    const prev = process.env.HOST;
    delete process.env.HOST;
    let mod;
    jest.isolateModules(() => {
      mod = require('../proxy/server.js');
    });
    if (prev === undefined) {
      delete process.env.HOST;
    } else {
      process.env.HOST = prev;
    }
    expect(mod.LISTEN_HOST).toBe('127.0.0.1');
  });

  test('LISTEN_HOST honours an explicit HOST env (operator opt-in to LAN sharing)', () => {
    const prev = process.env.HOST;
    process.env.HOST = '0.0.0.0';
    let mod;
    jest.isolateModules(() => {
      mod = require('../proxy/server.js');
    });
    if (prev === undefined) {
      delete process.env.HOST;
    } else {
      process.env.HOST = prev;
    }
    expect(mod.LISTEN_HOST).toBe('0.0.0.0');
  });

  test('server.listen binds the explicit host — never a bare wildcard', () => {
    // A bare server.listen(PORT) binds ::/0.0.0.0. The call must pass the
    // host so the advertised loopback address is the actual bind.
    expect(SRC).toMatch(/server\.listen\(PORT,\s*LISTEN_HOST/);
  });
});
