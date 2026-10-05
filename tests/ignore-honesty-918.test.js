const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('.gitignore honesty', () => {
  const gitignore = read('.gitignore');

  test('package-manager log entries only name npm (npm-only repo)', () => {
    // package-lock.json is committed; no yarn.lock / pnpm-lock.yaml exists.
    expect(gitignore).not.toMatch(/yarn/i);
    expect(gitignore).not.toMatch(/pnpm/i);
  });

  test.each(['build', 'out', 'data', 'user-data', 'backups'])('does not ignore nonexistent dir %s/', (dir) => {
    expect(gitignore).not.toMatch(new RegExp(`^${dir}/$`, 'm'));
  });

  test('does not ignore db files nothing produces', () => {
    expect(gitignore).not.toMatch(/^\*\.db\*?$/m);
    expect(gitignore).not.toMatch(/\.sqlite\b/);
  });
});

describe('jest.config.js honesty', () => {
  const configText = read('jest.config.js');
  const jestConfig = require(path.join(ROOT, 'jest.config.js'));

  test('every testMatch glob root dir exists', () => {
    for (const pattern of jestConfig.testMatch) {
      const rootDir = pattern.replace(/^\*\*\//, '').split('/')[0];
      expect(fs.existsSync(path.join(ROOT, rootDir))).toBe(true);
    }
  });

  test('testPathIgnorePatterns names real or generated paths only', () => {
    const generated = new Set(['node_modules', 'dist', 'coverage', '.git']);
    for (const pattern of jestConfig.testPathIgnorePatterns) {
      const dir = pattern.replace(/^\//, '').replace(/\/$/, '');
      const exists = fs.existsSync(path.join(ROOT, dir));
      expect(exists || generated.has(dir)).toBe(true);
    }
  });

  test('does not reference deleted modules in comments', () => {
    for (const phantom of ['TextureManager', 'ProgressiveLoader', 'WebGPURenderer']) {
      expect(configText).not.toMatch(new RegExp(phantom));
    }
  });
});
