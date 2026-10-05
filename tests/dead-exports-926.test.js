/**
 * Module-boundary honesty (round 926) — every `export` keyword in the audited
 * files must have at least one external consumer (ESM import or CJS require),
 * repo-wide including tests. An exported symbol nobody imports is a dead
 * public-surface claim: the file advertises API that cannot be reached, the
 * same class closed by #1165-#1172 and #1210.
 *
 * Audited files:
 *   - src/vr/accessibility/CaptionSystem.js (CPS_FULLWIDTH, CPS_HALFWIDTH were
 *     exported but consumed only inside the file — test destructuring removed
 *     in #1174 left the keyword dead)
 *   - src/a11y/accessibility.js (osHighContrast exported but called only by
 *     prefersHighContrast inside the same file)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const AUDITED = ['src/vr/accessibility/CaptionSystem.js', 'src/a11y/accessibility.js'];

function collectJsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
        continue;
      }
      collectJsFiles(full, out);
    } else if (entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(src) {
  return src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n');
}

function exportedNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/^\s*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)/gm)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (!p) {
        continue;
      }
      const asM = p.match(/(\w+)\s+as\s+(\w+)/);
      names.add(asM ? asM[2] : p.split(/\s+/)[0]);
    }
  }
  if (/export\s+default/.test(src)) {
    names.add('default');
  }
  return names;
}

function consumedNames(consumer, base) {
  const out = new Set();
  const baseRe = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of consumer.matchAll(
    new RegExp(`import\\s+([^;]+?)\\s+from\\s+['\`][^'\`]*${baseRe}(?:\\.js)?['\`]`, 'g')
  )) {
    const spec = m[1];
    if (/\*\s+as\s+\w+/.test(spec)) {
      out.add('*');
    }
    if (!spec.trim().startsWith('{') && /^\s*\w+\s*,?/.test(spec)) {
      out.add('default');
    }
    for (const mm of spec.matchAll(/\{([^}]*)\}/g)) {
      for (const part of mm[1].split(',')) {
        const p = part.trim();
        if (!p) {
          continue;
        }
        const asM = p.match(/(\w+)\s+as\s+(\w+)/);
        out.add(asM ? asM[1] : p.split(/\s+/)[0]);
      }
    }
  }
  for (const m of consumer.matchAll(
    new RegExp(
      `(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*require\\(\\s*['\`][^'\`]*${baseRe}(?:\\.js)?['\`]\\s*\\)`,
      'g'
    )
  )) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (!p) {
        continue;
      }
      const asM = p.match(/(\w+)\s*:\s*(\w+)/);
      out.add(asM ? asM[1] : p.split(/\s+/)[0]);
    }
  }
  for (const m of consumer.matchAll(
    new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*require\\(\\s*['\`][^'\`]*${baseRe}(?:\\.js)?['\`]\\s*\\)`, 'g')
  )) {
    for (const pm of consumer.matchAll(new RegExp(`\\b${m[1]}\\.(\\w+)`, 'g'))) {
      out.add(pm[1]);
    }
  }
  return out;
}

describe('module-boundary honesty: every export has an external consumer', () => {
  const corpus = new Map();
  for (const f of collectJsFiles(ROOT)) {
    corpus.set(path.relative(ROOT, f).replace(/\\/g, '/'), stripComments(fs.readFileSync(f, 'utf8')));
  }

  test.each(AUDITED)('%s: no dead export keywords', (rel) => {
    const src = corpus.get(rel);
    expect(src).toBeDefined();
    const names = exportedNames(src);
    const base = path.basename(rel, '.js');
    const consumed = new Set();
    for (const [f, txt] of corpus) {
      if (f === rel) {
        continue;
      }
      for (const n of consumedNames(txt, base)) {
        consumed.add(n);
      }
    }
    const dead = consumed.has('*') ? [] : [...names].filter((n) => !consumed.has(n));
    expect(dead).toEqual([]);
  });
});
