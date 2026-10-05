const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const gitignore = read('.gitignore');
const pkg = require('../package.json');

describe('SETUP/QUICK docs stay aligned with reality', () => {
  test('never prescribes tracking a gitignored path to deploy', () => {
    const setup = read('docs/SETUP.md');
    // dist/ is gitignored; "git add dist" + push does not deploy Pages —
    // cd.yml deploys dist/ via actions/deploy-pages on pushes to main.
    expect(setup).not.toMatch(/git add\s+(-f\s+)?dist/);
    for (const doc of ['docs/SETUP.md', 'docs/QUICK_START.md', 'docs/QUICKSTART.md']) {
      const text = read(doc);
      const adds = text.match(/git add\s+\S+/g) || [];
      for (const line of adds) {
        const target = line
          .replace('git add', '')
          .trim()
          .replace(/^-f\s+/, '');
        expect(gitignore).not.toContain(`\n${target}/`);
      }
    }
  });

  test('quick-start docs do not pin a lint error count main cannot meet', () => {
    // main has a nonzero eslint baseline (brace-style etc.); #1154 fixed the
    // same false claim in INSTRUCTIONS_*. Gate wording must stay relative.
    for (const doc of ['docs/QUICK_START.md', 'docs/QUICKSTART.md']) {
      const text = read(doc);
      expect(text).not.toMatch(/0 errors expected|0 errors|zero errors/i);
    }
  });

  test('every npm script the docs reference exists in package.json', () => {
    for (const doc of ['docs/SETUP.md', 'docs/QUICK_START.md', 'docs/QUICKSTART.md']) {
      const text = read(doc);
      const refs = text.match(/npm run ([a-z:-]+)/g) || [];
      for (const ref of refs) {
        const name = ref.replace('npm run ', '');
        expect(pkg.scripts).toHaveProperty(name);
      }
    }
  });

  test('doc node version claims do not contradict package.json engines', () => {
    // engines allows >=18; a doc demanding a higher floor is a dead gate.
    const engines = pkg.engines?.node || '';
    const min = parseInt(engines.replace(/[^0-9]/g, '').slice(0, 2), 10);
    for (const doc of ['docs/SETUP.md', 'docs/QUICK_START.md']) {
      const text = read(doc);
      const claims = text.match(/Node\.js\s*(\d+)\+?/g) || [];
      for (const c of claims) {
        const n = parseInt(c.replace(/\D/g, ''), 10);
        expect(n).toBeLessThanOrEqual(min);
      }
    }
  });
});
