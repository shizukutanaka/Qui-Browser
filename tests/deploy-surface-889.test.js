/**
 * Round 889 — dead-deploy-surface invariant: package.json must not ship a
 * `deploy:gh-pages` script whose `gh-pages -d dist` uploads a root-base build
 * (`base: '/'` when BASE_PATH is unset) that 404s every asset under the
 * project's `/Qui-Browser/` Pages subpath — and DEPLOYMENT_GUIDE must not
 * prescribe the same broken path or resurrect the deleted deploy.yml
 * workflow (#1146 established cd.yml as the single Pages deployer).
 *
 * Pre-fix state: `deploy:gh-pages` invoked a CLI absent from devDependencies;
 * the guide told readers to `gh-pages -d dist` / `gh repo deploy` (not a real
 * gh subcommand) and to create .github/workflows/deploy.yml with a wrong repo
 * name (`/qui-browser-vr/`).
 */
const { readFileSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const guide = readFileSync(join(root, 'docs/DEPLOYMENT_GUIDE.md'), 'utf8');

describe('GitHub Pages deploy surface is honest', () => {
  test('no deploy:gh-pages script (root-base build 404s on the subpath Pages site)', () => {
    expect(pkg.scripts['deploy:gh-pages']).toBeUndefined();
  });

  test('no script shells out to the undeclared gh-pages CLI', () => {
    const offenders = Object.entries(pkg.scripts).filter(([, cmd]) => /\bgh-pages\b/.test(cmd));
    expect(offenders).toEqual([]);
  });

  test('guide does not prescribe gh-pages -d dist or the nonexistent gh repo deploy', () => {
    expect(guide).not.toMatch(/gh-pages -d/);
    expect(guide).not.toMatch(/gh repo deploy/);
  });

  test('guide does not tell readers to recreate deploy.yml (deleted at #1146)', () => {
    expect(guide).not.toMatch(/workflows\/deploy\.yml/);
    expect(guide).not.toMatch(/name: Deploy to GitHub Pages/);
  });

  test('guide points GitHub Pages deploys at cd.yml and the real Pages URL', () => {
    expect(guide).toMatch(/cd\.yml/);
    expect(guide).toMatch('shizukutanaka.github.io/Qui-Browser');
    expect(guide).not.toMatch(/yourusername\.github\.io/);
  });

  test('no other deploy script references a path that cannot work', () => {
    // netlify/vercel stay: documented global-CLI conveniences with live config files
    expect(pkg.scripts['deploy:netlify']).toContain('--dir=dist');
    expect(pkg.scripts['deploy:vercel']).toContain('vercel');
  });
});
