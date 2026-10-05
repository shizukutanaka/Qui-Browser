const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const guide = fs.readFileSync(path.join(ROOT, 'docs/DEPLOYMENT_GUIDE.md'), 'utf8');

describe('DEPLOYMENT_GUIDE stays aligned with shipped files', () => {
  test('never prescribes a production-only install before a build', () => {
    // vite/terser are devDependencies — `npm ci --only=production` always
    // breaks `npm run build`. (#1144 fixed the real Dockerfile for this.)
    expect(guide).not.toMatch(/npm ci --only=production[\s\S]{0,400}npm run build/);
    expect(guide).not.toMatch(/npm install --only=production/);
  });

  test('tells readers to use files the repo actually ships', () => {
    // No "Create X" instruction for a file that already exists — the
    // shipped file is the single source of truth.
    const shipped = [
      'Dockerfile',
      'docker-compose.yml',
      'netlify.toml',
      'vercel.json',
      'docker/nginx.conf',
      'docker/healthcheck.sh'
    ];
    for (const f of shipped) {
      const re = new RegExp('Create `' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`');
      expect({ file: f, saysCreate: re.test(guide) }).toEqual({
        file: f,
        saysCreate: false
      });
    }
  });

  test('references no repo paths that do not exist', () => {
    // The compose sample used to wire in a TLS proxy at
    // `proxy/nginx.conf` + `./certs` — neither exists (proxy/ is a
    // Node.js CORS proxy, not nginx config).
    for (const ghost of ['proxy/nginx.conf', './certs', 'certs/']) {
      expect(guide).not.toContain(ghost);
    }
  });
});
