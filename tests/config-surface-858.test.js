/**
 * Config-surface honesty — ignore files and jest.config must not carry
 * entries for tooling that does not exist in this repository.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
      walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
};

describe('config surface honesty', () => {
  test('.gitignore has no duplicate entries', () => {
    const entries = read('.gitignore')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    const seen = new Set();
    const dupes = entries.filter((e) => {
      if (seen.has(e)) {
        return true;
      }
      seen.add(e);
      return false;
    });
    expect(dupes).toEqual([]);
  });

  test('.gitignore drops entries for tools never used here', () => {
    const gitignore = read('.gitignore');
    // nyc was never a dependency — coverage is jest's own (coverage/)
    expect(gitignore).not.toMatch(/nyc_output/);
    // Parcel was never the bundler (webpack -> vite)
    expect(gitignore).not.toMatch(/parcel-cache/);
    // *.sw? already covers .swp/.swo/.swn — spell-outs are dead weight
    expect(gitignore).not.toMatch(/^\*\.sw[pon]$/m);
    // still ignores the essentials
    for (const keep of ['node_modules/', 'dist/', '.env', 'coverage/']) {
      expect(gitignore).toContain(keep);
    }
  });

  test('.prettierignore drops entries nothing can produce', () => {
    const prettierignore = read('.prettierignore');
    // The only producer was the deleted check-performance-regression workflow
    expect(prettierignore).not.toMatch(/benchmark-results/);
    expect(prettierignore).toContain('package-lock.json');
  });

  test('every jest moduleNameMapper alias has real users in the repo', () => {
    const jestConfig = read('jest.config.js');
    const mapper = jestConfig.match(/moduleNameMapper:\s*\{([^}]*)\}/);
    if (mapper) {
      const aliases = [...mapper[1].matchAll(/'\^([^']+)'/g)].map((m) => m[1]);
      const files = walk(ROOT).filter((f) => /\.(js|mjs|cjs|jsx|ts|tsx)$/.test(f) && !f.includes('/tests/'));
      const corpus = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
      for (const alias of aliases) {
        const prefix = alias.replace('(.*)$', '');
        expect(corpus.includes(`from '${prefix}`) || corpus.includes(`require('${prefix}`)).toBe(true);
      }
    } else {
      expect(jestConfig).not.toMatch(/moduleNameMapper/);
    }
  });

  test('jest coverage exclusions only name paths that exist', () => {
    const jestConfig = read('jest.config.js');
    const negations = [...jestConfig.matchAll(/'!(\*\*\/|)([a-zA-Z_-]+)\/\*\*'/g)].map((m) => m[2]);
    for (const dir of negations) {
      expect(fs.existsSync(path.join(ROOT, dir))).toBe(true);
    }
  });
});
