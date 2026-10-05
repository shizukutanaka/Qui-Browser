const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const viteSource = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8');
const pkg = require('../package.json');

function* srcFiles(dir = path.join(ROOT, 'src')) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* srcFiles(p);
    } else if (entry.isFile()) {
      yield p;
    }
  }
}

describe('vite.config declares no dead surface', () => {
  it('every resolve.alias has at least one importer in src', () => {
    const aliasMatch = viteSource.match(/alias:\s*\{([^}]*)\}/);
    if (!aliasMatch) {
      return; // no aliases configured — nothing to check
    }
    const names = [...aliasMatch[1].matchAll(/'(@[\w-]+)'/g)].map((m) => m[1]);
    const allSrc = [...srcFiles()].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    for (const name of names) {
      expect(allSrc).toContain(`from '${name}`);
    }
  });

  it('css.preprocessorOptions only configures languages actually used', () => {
    // A configured-but-unused preprocessor poisons any future file of that
    // type (the toolchain may not even be installed).
    const hasScssFiles = [...srcFiles()].some((f) => /\.s[ac]ss$/.test(f));
    const sassDeclared = 'sass' in (pkg.devDependencies || {}) || 'sass' in (pkg.dependencies || {});
    if (!hasScssFiles && !sassDeclared) {
      expect(viteSource).not.toMatch(/preprocessorOptions/);
    }
  });

  it('worker config only exists when src actually spawns workers', () => {
    const usesWorkers = [...srcFiles()].some((f) => /new\s+(Shared)?Worker\s*\(/.test(fs.readFileSync(f, 'utf8')));
    if (!usesWorkers) {
      expect(viteSource).not.toMatch(/worker:\s*\{/);
    }
  });

  it('optimizeDeps.exclude only names declared dependencies', () => {
    const excludeMatch = viteSource.match(/optimizeDeps:\s*\{[^}]*exclude:\s*\[([^\]]*)\]/s);
    if (!excludeMatch) {
      return;
    }
    const excluded = [...excludeMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const declared = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.optionalDependencies
    };
    for (const dep of excluded) {
      expect(declared[dep]).toBeDefined();
    }
  });
});
