/**
 * Round 874: PerformanceMonitor dead public surface
 *
 * Class-pinning invariant: every method PerformanceMonitor defines must be
 * reachable — either called by an outside consumer or invoked internally
 * via `this.` from a method that is itself reachable. getReport/exportCSV/
 * reset were removed after verification of zero call sites.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MON = path.join(ROOT, 'src', 'utils', 'PerformanceMonitor.js');
const monSource = fs.readFileSync(MON, 'utf8');

function* srcFiles(dir = path.join(ROOT, 'src')) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* srcFiles(full);
    } else if (entry.name.endsWith('.js')) {
      yield full;
    }
  }
}

// Method definitions live at top-level inside the exported class body:
// lines matching `name(` at 2-space indent that aren't constructors/ifs.
function definedMethods(source) {
  const names = [];
  for (const line of source.split('\n')) {
    const m = line.match(/^ {2}([a-zA-Z_$][\w$]*)\s*\(/);
    if (m && !['if', 'for', 'while', 'switch', 'catch', 'constructor', 'return', 'else'].includes(m[1])) {
      names.push(m[1]);
    }
  }
  return names;
}

// Call sites anywhere: `this.m(` or `x.m(` on every src file, plus internal
// `this.m(` calls inside PerformanceMonitor (excluding the definition line).
function callSites(name) {
  const re = new RegExp(`(?:this\\.|[a-zA-Z_$][\\w$]*\\.)${name}\\s*\\(`, 'g');
  const hits = [];
  for (const file of srcFiles()) {
    if (file === MON) {
      continue;
    }
    const src = fs.readFileSync(file, 'utf8');
    for (const line of src.split('\n')) {
      if (re.test(line) && !line.trimStart().startsWith('*')) {
        hits.push(line.trim());
      }
    }
    re.lastIndex = 0;
  }
  const defRe = new RegExp(`^ {2}${name}\\s*\\(`);
  for (const line of monSource.split('\n')) {
    if (defRe.test(line)) {
      continue;
    }
    if (line.trimStart().startsWith('*')) {
      continue;
    }
    if (new RegExp(`this\\.${name}\\s*\\(`).test(line)) {
      hits.push('internal:' + line.trim());
    }
  }
  return hits;
}

describe('PerformanceMonitor reachable-surface invariant', () => {
  const methods = definedMethods(monSource);

  test('every defined method has at least one call site', () => {
    const orphans = methods.filter((m) => callSites(m).length === 0);
    expect(orphans).toEqual([]);
  });

  test('removed dead-reporting surface stays gone', () => {
    for (const dead of ['getReport', 'exportCSV']) {
      expect(methods).not.toContain(dead);
    }
    expect(methods.filter((m) => m === 'reset')).toEqual([]);
  });

  test('JSDoc usage block does not prescribe dead calls', () => {
    for (const dead of ['getReport', 'exportCSV', 'reset']) {
      expect(monSource).not.toMatch(new RegExp(`\\.${dead}\\s*\\(`));
    }
  });
});
