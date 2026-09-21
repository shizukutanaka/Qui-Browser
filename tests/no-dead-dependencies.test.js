/**
 * Dead-dependency sweep: every package in dependencies/devDependencies must be
 * load-bearing — imported/required in source, named in a config file, used by
 * an npm script, or vendored via a node_modules path in HTML. Measured
 * 2026-09-20: `core-js` was declared but referenced nowhere (babel ran without
 * useBuiltIns and the vite legacy plugin stayed commented out) and
 * `@tensorflow/tfjs` survived only as a stale optimizeDeps.exclude entry for a
 * package that was never installed.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = require('../package.json');

// Files allowed to provide a usage signal (not package.json's own deps lists).
const SCAN_DIRS = ['src', 'tests', 'tools', 'proxy', 'public'];
const SCAN_FILES = [
  'index.html',
  'vite.config.js',
  'jest.config.js',
  '.babelrc',
  'babel.config.js',
  'eslint.config.js'
];

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

const corpus = [];
for (const d of SCAN_DIRS) {
  const abs = path.join(ROOT, d);
  if (fs.existsSync(abs)) {
    for (const p of walk(abs)) {
      corpus.push(fs.readFileSync(p, 'utf8'));
    }
  }
}
for (const f of SCAN_FILES) {
  const abs = path.join(ROOT, f);
  if (fs.existsSync(abs)) {
    corpus.push(fs.readFileSync(abs, 'utf8'));
  }
}
corpus.push(JSON.stringify(pkg.scripts));
const haystack = corpus.join('\n');

// Engine deps required implicitly by a runner rather than named in any file:
// babel-jest calls require('@babel/core') internally.
const IMPLICIT = new Set(['@babel/core']);

const all = { ...pkg.dependencies, ...pkg.devDependencies };
const unused = Object.keys(all).filter((name) => !IMPLICIT.has(name) && !haystack.includes(name));

test('every declared dependency is referenced somewhere', () => {
  expect(unused).toEqual([]);
});
