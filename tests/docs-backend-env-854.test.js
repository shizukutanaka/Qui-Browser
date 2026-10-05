const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

// Live docs audited this round. Historical/research docs (IMPLEMENTATION,
// INSTRUCTIONS_*, DEVELOPER_ONBOARDING, BUILD_OPTIMIZATION_GUIDE) are excluded:
// their stale refs describe the deleted stack as history, not instructions.
const AUDITED_DOCS = ['README.md', 'docs/FAQ.md', 'docs/SETUP.md', 'docs/ARCHITECTURE.md'];

describe('dead backend/env-config surface (round 854)', () => {
  test('.env.example declares only vars the app actually reads', () => {
    const src = fs
      .readdirSync(path.join(ROOT, 'src'), { recursive: true })
      .filter((f) => f.endsWith('.js'))
      .map((f) => read(path.join('src', String(f))))
      .join('\n');
    const vars = read('.env.example')
      .split('\n')
      .map((l) => l.match(/^([A-Z][A-Z0-9_]*)=/))
      .filter(Boolean)
      .map((m) => m[1]);
    expect(vars.length).toBeGreaterThan(0);
    for (const v of vars) {
      expect(v).toMatch(/^VITE_/); // vite only exposes VITE_* to client code
      expect(src).toContain(`import.meta.env.${v}`);
    }
  });

  test('superseded .env.stripe for the deleted billing server is gone', () => {
    expect(exists('.env.stripe')).toBe(false);
  });

  test.each(AUDITED_DOCS)('%s never prescribes the deleted Express backend', (doc) => {
    const body = read(doc);
    for (const dead of ['start:server', 'server/index', 'server/stripe-billing', 'STRIPE']) {
      expect(body).not.toContain(dead);
    }
  });

  test.each(['docs/SETUP.md'])('%s only references runnable commands/files', (doc) => {
    const body = read(doc);
    expect(body).not.toContain('webpack');
    const scripts = require(path.join(ROOT, 'package.json')).scripts;
    for (const m of body.matchAll(/npm run ([a-zA-Z:_-]+)/g)) {
      expect(scripts).toHaveProperty(m[1]);
    }
    for (const m of body.matchAll(/npm test ([a-zA-Z0-9_.-]+\.test\.js)/g)) {
      expect(exists(path.join('tests', m[1]))).toBe(true);
    }
  });

  test('dev-server doc instructions match the vite port', () => {
    const vite = read('vite.config.js');
    const port = Number(vite.match(/port:\s*(\d+)/)[1]);
    const setup = read('docs/SETUP.md');
    expect(setup).not.toMatch(/localhost:(?!5173)\d{4}/);
    expect(setup).toContain(`localhost:${port}`);
    expect(setup).toContain(`YOUR-IP:${port}`);
  });
});
