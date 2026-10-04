/**
 * Class seal — .babelrc must not re-declare transform options the root
 * babel.config.js already supplies.
 *
 * Why: babel-jest loads BOTH configs for every repo file — babel.config.js
 * (root config, applies in every env, including node_modules) and .babelrc
 * (file-relative). .babelrc carried the identical
 * `@babel/preset-env` + `{ targets: { node: 'current' } }` stack twice —
 * once at top level and once inside `env.test` — a pure duplicate of what
 * babel.config.js already provides. The only thing .babelrc uniquely owns
 * is the env.test plugin that stubs `import.meta` for CommonJS. Duplicated
 * preset stacks read as if .babelrc had responsibilities it does not, and
 * double-register the same transform.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

describe('.babelrc owns only its unique piece — the env.test import.meta stub', () => {
  const babelrc = JSON.parse(fs.readFileSync(path.join(ROOT, '.babelrc'), 'utf8'));

  test('declares no top-level presets (babel.config.js already supplies preset-env)', () => {
    expect(babelrc.presets).toBeUndefined();
  });

  test('env.test re-declares no presets — only plugins', () => {
    expect(babelrc.env?.test?.presets).toBeUndefined();
    expect(babelrc.env?.test?.plugins).toBeDefined();
  });

  test('keeps the import.meta stub plugin wired (tests run as CommonJS)', () => {
    const plugins = babelrc.env.test.plugins;
    expect(plugins.some((p) => p.includes('babel-plugin-import-meta'))).toBe(true);
    const pluginPath = path.join(
      ROOT,
      plugins.find((p) => p.includes('babel-plugin-import-meta'))
    );
    expect(fs.existsSync(pluginPath)).toBe(true);
  });

  test('root babel.config.js still supplies preset-env for every env', () => {
    const cfg = require(path.join(ROOT, 'babel.config.js'));
    const names = (cfg.presets || []).map((p) => (Array.isArray(p) ? p[0] : p));
    expect(names.some((n) => String(n).includes('preset-env'))).toBe(true);
  });
});
