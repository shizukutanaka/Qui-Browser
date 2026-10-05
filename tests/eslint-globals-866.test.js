const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const ESLINTRC = path.join(ROOT, '.eslintrc.json');

const read = (p) => fs.readFileSync(p, 'utf8');

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p);
    } else if (e.name.endsWith('.js')) {
      yield p;
    }
  }
}

// Strip the places a name can appear without being a real code reference:
// comment/JSDoc lines, and `import`/`export ... from` lines (a module-namespace
// import is a local binding, not an ambient global).
function codeLines(file) {
  return read(file)
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !(
        t.startsWith('//') ||
        t.startsWith('*') ||
        t.startsWith('/*') ||
        t.startsWith('import ') ||
        t.startsWith('export ')
      );
    })
    .join('\n');
}

describe('.eslintrc.json globals describe code that exists', () => {
  it('every declared global is referenced as a bare identifier in src/', () => {
    const cfg = JSON.parse(read(ESLINTRC));
    const globals = Object.keys(cfg.globals || {});
    const corpus = [...walk(SRC)].map(codeLines).join('\n');
    const dead = globals.filter((g) => !new RegExp(`\\b${g}\\b`).test(corpus));
    expect(dead).toEqual([]);
  });
});
