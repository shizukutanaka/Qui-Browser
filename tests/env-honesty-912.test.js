// Invariants for write-only env/config surface (round 912).
// Class pinned: an env/global variable that no consumer can ever read is
// dead configuration — it describes a knob that doesn't exist.
// jest globals inject bare identifiers (not process.env.*) — nothing in
// src/ or tests/ reads NODE_ENV or VR_BROWSER_VERSION as a global.
// docker-compose env vars land in an nginx container serving static dist —
// nothing in the container reads NODE_ENV or VR_BROWSER_VERSION either.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const jestCfg = fs.readFileSync(path.join(ROOT, 'jest.config.js'), 'utf8');
const compose = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');

const consumers = [
  ...fs
    .readdirSync(path.join(ROOT, 'src'), { recursive: true })
    .filter((f) => String(f).endsWith('.js'))
    .map((f) => path.join(ROOT, 'src', String(f))),
  ...fs
    .readdirSync(path.join(ROOT, 'tests'), { recursive: true })
    .filter((f) => String(f).endsWith('.js'))
    .map((f) => path.join(ROOT, 'tests', String(f)))
    // this pinning file legitimately names the variables it audits
    .filter((f) => f !== __filename)
];

function isConsumed(name) {
  return consumers.some((f) => fs.readFileSync(f, 'utf8').includes(name));
}

describe('env/config honesty — no write-only variables', () => {
  test('VR_BROWSER_VERSION is not declared where nothing consumes it', () => {
    // Sanity: prove the class by showing no consumer exists, then require
    // the declarations be gone.
    expect(isConsumed('VR_BROWSER_VERSION')).toBe(false);
    expect(jestCfg).not.toMatch(/VR_BROWSER_VERSION/);
    expect(compose).not.toMatch(/VR_BROWSER_VERSION/);
  });

  test('jest globals block is gone — neither key is read anywhere', () => {
    expect(isConsumed('VR_BROWSER_VERSION')).toBe(false);
    // NODE_ENV as a bare global (not process.env.NODE_ENV) is unread too.
    expect(jestCfg).not.toMatch(/globals:/);
  });

  test('docker-compose declares no unconsumed env vars', () => {
    // The image runs nginx serving static dist — only TZ has a real effect
    // (log timestamps). NODE_ENV/VR_BROWSER_VERSION were decorative.
    const envBlock = compose.match(/environment:\n((?:\s+- .+\n)+)/);
    expect(envBlock).not.toBeNull();
    const vars = envBlock[1]
      .trim()
      .split('\n')
      .map((l) =>
        l
          .replace(/^\s*-\s*/, '')
          .split('=')[0]
          .trim()
      );
    expect(vars).toEqual(['TZ']);
  });

  test('every .env.example var is consumed by a VITE_ reference', () => {
    const envEx = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
    const declared = envEx
      .split('\n')
      .filter((l) => l.match(/^VITE_\w+=/))
      .map((l) => l.split('=')[0]);
    expect(declared.length).toBeGreaterThan(0);
    for (const v of declared) {
      expect(isConsumed(v)).toBe(true);
    }
  });
});
