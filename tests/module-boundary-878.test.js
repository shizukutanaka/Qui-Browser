// Class pin: every `export` in these leaf modules must name a public symbol
// with at least one consumer outside the defining file. An exported name that
// is only referenced inside its own file is dead surface — a public API that
// does not exist — and must not carry the `export` keyword.
//
// Scope is limited to the modules this round owns; other modules with dead
// exports are owned by open PRs.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const OWNED_FILES = [
  'src/vr/browser/bookmarkLayout.js',
  'src/vr/browser/readerLayout.js',
  'src/vr/input/keyboardLayout.js',
  'src/vr/ui/contrast.js',
  'src/vr/ui/textWrap.js',
  'src/vr/accessibility/captionLayout.js',
  'src/vr/accessibility/crossModal.js'
];

function trackedJsFiles() {
  const out = execSync('git ls-files "*.js"', { cwd: ROOT, encoding: 'utf8' });
  return out
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !p.startsWith('node_modules/') && !p.startsWith('dist/'));
}

function exportedNames(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const names = [];
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.push(m[1]);
  }
  return names;
}

describe('module boundary honesty', () => {
  const files = trackedJsFiles();

  test.each(OWNED_FILES)('%s: every exported symbol has an external consumer', (file) => {
    const names = exportedNames(file);
    const consumers = new Map();
    const others = files.filter((f) => f !== file);
    for (const name of names) {
      const re = new RegExp(`\\b${name}\\b`);
      const hits = others.filter((f) => {
        try {
          return re.test(fs.readFileSync(path.join(ROOT, f), 'utf8'));
        } catch {
          return false;
        }
      });
      consumers.set(name, hits);
    }
    const dead = [...consumers.entries()].filter(([, hits]) => hits.length === 0).map(([name]) => name);
    expect(dead).toEqual([]);
  });
});
