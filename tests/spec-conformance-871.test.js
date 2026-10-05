const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

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

const SRC_FILES = [...walk(path.join(ROOT, 'src'))];
const spec = fs.readFileSync(path.join(ROOT, 'docs/SPEC.md'), 'utf8');
const specRow = (id) => spec.split('\n').find((l) => l.trim().startsWith(`| ${id} `));

// Occurrences of `needle(` in src files, excluding the named owner files,
// comment lines (`*`), and lines matching `skip` (the method declaration
// itself, or an internal delegation like `this.textureManager.`).
function callers(needle, ownerFiles, skip) {
  const hits = [];
  for (const f of SRC_FILES) {
    if (ownerFiles.some((o) => f.endsWith(o))) {
      continue;
    }
    const code = fs.readFileSync(f, 'utf8');
    for (const m of code.matchAll(new RegExp(needle + '\\s*\\(', 'g'))) {
      const lineStart = code.lastIndexOf('\n', m.index) + 1;
      const lineEnd = code.indexOf('\n', m.index);
      const line = code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      if (line.trim().startsWith('*') || skip.test(line)) {
        continue;
      }
      hits.push(`${path.relative(ROOT, f)}: ${line.trim()}`);
    }
  }
  return hits;
}

describe('SPEC.md conformance claims stay honest about unreachable surface', () => {
  it('FR-4.3 (KTX2 textures) is not claimed implemented while it is unreachable', () => {
    expect(
      callers('loadTexture', ['TextureManager.js', 'ProgressiveLoader.js'], /async\s+loadTexture|textureManager\./)
    ).toEqual([]);
    expect(fs.readdirSync(path.join(ROOT, 'public')).filter((f) => f.endsWith('.ktx2'))).toEqual([]);
    // The ProgressiveLoader delegation reads `window.textureManager`, which
    // nothing assigns — assert the delegation target is still unset.
    const assigns = SRC_FILES.filter((f) => {
      const code = fs.readFileSync(f, 'utf8');
      return /window\.textureManager\s*=/.test(code);
    });
    expect(assigns).toEqual([]);
    expect(specRow('FR-4.3')).toContain('❌');
  });

  it('FR-1.6 flags billboard/nudgeDistance as unreachable while callers are absent', () => {
    expect(callers('nudgeDistance', ['WindowManager.js'], /nudgeDistance\s*\(delta\)/)).toEqual([]);
    const billboardWriters = SRC_FILES.filter((f) => {
      if (f.endsWith('WindowManager.js')) {
        return false;
      }
      return /\.billboard\s*=/.test(fs.readFileSync(f, 'utf8'));
    });
    expect(billboardWriters).toEqual([]);
    expect(specRow('FR-1.6')).toContain('到達不能');
  });
});
