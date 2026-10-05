// Class pin (proxy surface): every `export` in proxy/ must name a symbol with
// at least one consumer outside the defining file. `npm run proxy` executes
// server.js directly, so an exported-but-self-referenced symbol is dead
// public surface and must not carry the keyword.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function trackedJsFiles() {
  const out = execSync('git ls-files "*.js" "*.mjs"', { cwd: ROOT, encoding: 'utf8' });
  return out
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !p.startsWith('node_modules/') && !p.startsWith('dist/'));
}

function exportedNames(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map(
    (m) => m[1]
  );
}

describe('proxy module boundary honesty', () => {
  const files = trackedJsFiles();

  test.each(['proxy/server.js', 'proxy/ssrfGuard.js'])('%s: every exported symbol has an external consumer', (file) => {
    const names = exportedNames(file);
    const others = files.filter((f) => f !== file);
    const dead = names.filter((name) => {
      const re = new RegExp(`\\b${name}\\b`);
      return !others.some((f) => re.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    });
    expect(dead).toEqual([]);
  });
});
