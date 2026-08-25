/**
 * Every deploy path must build, and must serve the build.
 *
 * This is not hypothetical tidiness. The same defect has now been found in
 * all three deploy configurations, independently:
 *
 *   netlify.toml   publish = "."   command = "echo 'No build required'"
 *   vercel.json    outputDirectory "."   buildCommand "echo 'No build...'"
 *   Dockerfile     COPY . .  with no build step, served as the nginx root
 *
 * Each one ships `src/` as authored, which no browser can run: the imports are
 * bare specifiers and `import.meta.env` is a value Vite substitutes at build
 * time. Measured by reproducing the Docker document root and loading it in
 * Chromium — `window.QuiBrowser` undefined, and an uncaught
 * "TypeError: Cannot read properties of undefined (reading 'PROD')".
 *
 * Nothing caught it, because a static host answers 200 for index.html and the
 * Docker health check is a fixed 200 from nginx.conf. The failure is only
 * visible if you execute the page. So the rule gets pinned here instead:
 * config files are plain text, and reading them costs nothing.
 *
 * The CSP assertions are the same idea one layer down — a policy that permits
 * hosts the app never contacts is a permission granted for nothing.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Hosts no longer contacted by anything that ships. */
const FORBIDDEN_CSP_HOSTS = ['cdnjs.cloudflare.com', 'googletagmanager.com', 'google-analytics.com'];

describe('vercel.json deploys the build, not the sources', () => {
  const cfg = JSON.parse(read('vercel.json'));

  test('runs a real build', () => {
    expect(cfg.buildCommand).toMatch(/npm run build/);
    expect(cfg.buildCommand).not.toMatch(/No build required|^echo/);
  });

  test('publishes dist/', () => {
    expect(cfg.outputDirectory).toBe('dist');
  });

  test('installs from the lockfile', () => {
    expect(cfg.installCommand).toMatch(/npm ci/);
  });

  test('no header rule points at a directory that no longer exists', () => {
    for (const h of cfg.headers) {
      const dir = h.source.replace(/^\/+/, '').split('/')[0];
      if (dir && !dir.includes('(') && !dir.includes(':') && !dir.endsWith('.js')) {
        // Only assert on plain directory prefixes, not pattern sources.
        if (dir === 'assets') {
          const sub = h.source.replace(/^\/assets\//, '').split('/')[0];
          expect(fs.existsSync(path.join(ROOT, 'public', 'assets', sub))
            || fs.existsSync(path.join(ROOT, 'assets', sub))).toBe(true);
        }
      }
    }
  });

  test('CSP does not permit hosts the app never contacts', () => {
    const csp = cfg.headers
      .flatMap((h) => h.headers)
      .filter((kv) => kv.key === 'Content-Security-Policy')
      .map((kv) => kv.value);
    expect(csp.length).toBeGreaterThan(0);
    for (const value of csp) {
      for (const host of FORBIDDEN_CSP_HOSTS) {
        expect(value).not.toContain(host);
      }
      // 'unsafe-eval' is not needed: nothing in the bundle evals.
      expect(value).not.toContain("'unsafe-eval'");
    }
  });
});

describe('netlify.toml deploys the build, not the sources', () => {
  const toml = read('netlify.toml');

  test('runs a real build', () => {
    const command = /^\s*command\s*=\s*"([^"]+)"/m.exec(toml);
    expect(command).not.toBeNull();
    expect(command[1]).toMatch(/npm (ci|run)/);
    expect(command[1]).not.toMatch(/No build required/);
  });

  test('publishes dist/', () => {
    expect(/^\s*publish\s*=\s*"dist"/m.test(toml)).toBe(true);
  });

  test('CSP does not permit hosts the app never contacts', () => {
    for (const host of [...FORBIDDEN_CSP_HOSTS, "'unsafe-eval'"]) {
      expect(toml).not.toContain(host);
    }
  });
});

describe('Dockerfile builds and serves only the build output', () => {
  const dockerfile = read('Dockerfile');
  // Instructions only. Comments here explain *why* the old flags were wrong and
  // therefore quote them; asserting over the raw text would flag the
  // explanation as the defect it warns about.
  const instructions = dockerfile
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .join('\n');

  test('runs the build in the builder stage', () => {
    expect(instructions).toMatch(/RUN npm run build/);
  });

  test('installs from the lockfile, with devDependencies (vite lives there)', () => {
    expect(instructions).toMatch(/RUN npm ci\b/);
    expect(instructions).not.toMatch(/--only=production/);
  });

  test('copies dist/ into the image, not the whole tree', () => {
    const copies = [...instructions.matchAll(/^COPY --from=builder (\S+) (\S+)/gm)];
    expect(copies.length).toBeGreaterThan(0);
    for (const [, from] of copies) {
      expect(from).toMatch(/\/dist$/);
    }
  });

  test('.dockerignore keeps the lockfile, so npm ci can work', () => {
    const ignore = read('.dockerignore')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    expect(ignore).not.toContain('package-lock.json');
  });

  test('docker-compose serves dist/, not the repo root', () => {
    const compose = read('docker-compose.yml');
    expect(compose).not.toMatch(/^\s*-\s*\.\/:\/usr\/share\/nginx\/html/m);
    expect(compose).toMatch(/\.\/dist:\/usr\/share\/nginx\/html/);
  });
});
