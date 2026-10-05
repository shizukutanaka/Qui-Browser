/**
 * Dependency honesty (round 928): every package declared in package.json must
 * be referenced by something real — a source import/require, an npm script, or
 * a config file — so the manifest never claims a dependency nothing consumes.
 *
 * TOOLCHAIN lists packages that ARE the toolchain itself: they appear in no
 * import and no script, but are the runtime peers the declared tools need
 * (e.g. babel-jest pulls @babel/core). Anything outside the toolchain that is
 * referenced nowhere is a dead declaration (e.g. a plugin whose import was
 * removed, or a polyfill babel never injects).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));

const TOOLCHAIN = new Set(['@babel/core']);

const CODE_DIRS = ['src', 'tests', 'tools', 'proxy'];
const CONFIG_FILES = [
  'vite.config.js',
  'jest.config.js',
  'babel.config.js',
  '.babelrc',
  '.eslintrc.json',
  '.prettierrc.json'
];

function corpus() {
  const files = [];
  for (const dir of CODE_DIRS) {
    for (const f of fs.readdirSync(path.join(ROOT, dir), { recursive: true })) {
      if (/\.(js|mjs|cjs)$/.test(f)) {
        files.push(path.join(ROOT, dir, String(f)));
      }
    }
  }
  for (const f of CONFIG_FILES) {
    files.push(path.join(ROOT, f));
  }
  return files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
}

const corpusText = corpus();
const scripts = Object.values(pkg.scripts).join(' ');

describe('dead dependency declarations', () => {
  const deps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];

  test.each(deps)('%s is referenced by code, config, or a script', (dep) => {
    if (TOOLCHAIN.has(dep)) {
      return;
    }
    const inScripts = scripts.includes(dep);
    const inCode = corpusText.includes(dep);
    expect(inScripts || inCode).toBe(true);
  });
});
