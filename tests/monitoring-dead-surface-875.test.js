/**
 * Round 875: src/monitoring.js dead export surface + fake performance reporting
 *
 * Two pinned invariants:
 *  1. Every exported function in monitoring.js must have at least one caller —
 *     a named call site outside the file, or a bare-name call inside the file
 *     from a function that is itself reachable (the whole file is otherwise
 *     loaded only through `initializeMonitoring` in main.js and
 *     `disposeMonitoring` in VRApp).
 *  2. No telemetry may summarize state that can never be written —
 *     `performanceMetrics` was written only by the dead trackFPS/trackMemory/
 *     trackInteraction, so `reportPerformanceSummary` emitted all-zero
 *     reports on a real interval; both are gone.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MON = path.join(ROOT, 'src', 'monitoring.js');
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

// Names exported as `export (async )?function name(` or referenced in the
// trailing `export default { ... }` map.
function exportedFunctions(source) {
  const names = new Set();
  for (const line of source.split('\n')) {
    const m = line.match(/^export\s+(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/);
    if (m) {
      names.add(m[1]);
    }
  }
  return [...names];
}

// A call is `name(` on a non-comment, non-definition line. Inside
// monitoring.js module functions invoke each other by bare name; outside,
// consumers call `initializeMonitoring(` / `disposeMonitoring(` directly.
function callSites(name) {
  const defRe = new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const callRe = new RegExp(`\\b${name}\\s*\\(`);
  const hits = [];
  for (const file of srcFiles()) {
    const src = fs.readFileSync(file, 'utf8');
    for (const line of src.split('\n')) {
      const t = line.trim();
      if (t.startsWith('*') || t.startsWith('//')) {
        continue;
      }
      if (file === MON && defRe.test(line)) {
        continue;
      }
      if (callRe.test(line)) {
        hits.push(file + ': ' + t);
      }
    }
  }
  return hits;
}

describe('monitoring.js reachable-export invariant', () => {
  const exports = exportedFunctions(monSource);

  test('every exported function has at least one call site', () => {
    const orphans = exports.filter((name) => callSites(name).length === 0);
    expect(orphans).toEqual([]);
  });

  test('every export is referenced outside monitoring.js', () => {
    // An export nothing imports — not even a test seam — advertises a public
    // surface that does not exist. Internally-called helpers stay unexported.
    const others = [...srcFiles()].filter((f) => f !== MON);
    const testDir = path.join(ROOT, 'tests');
    for (const file of [path.join(ROOT, 'index.html'), ...fs.readdirSync(testDir).map((f) => path.join(testDir, f))]) {
      if (fs.existsSync(file) && file.endsWith('.js')) {
        others.push(file);
      }
    }
    // Code lines only — a docstring naming the symbol is not a consumer.
    const boundary = others
      .flatMap((f) =>
        fs
          .readFileSync(f, 'utf8')
          .split('\n')
          .filter((line) => {
            const t = line.trim();
            return !t.startsWith('*') && !t.startsWith('//');
          })
      )
      .join('\n');
    const unimported = exports.filter((name) => !new RegExp(`\\b${name}\\b`).test(boundary));
    expect(unimported).toEqual([]);
  });

  test('dead tracking/reporting exports stay removed', () => {
    const dead = [
      'trackPageView',
      'trackFPS',
      'trackMemory',
      'trackInteraction',
      'trackVRSession',
      'trackVRError',
      'captureError',
      'reportPerformanceSummary'
    ];
    for (const name of dead) {
      expect(exports).not.toContain(name);
      expect(callSites(name)).toEqual([]);
    }
  });

  test('no always-empty performance summary pipeline', () => {
    for (const ghost of ['performanceMetrics', 'reportPerformanceSummary', 'reportInterval', 'performance_summary']) {
      expect(monSource).not.toContain(ghost);
    }
  });

  test('JSDoc usage block does not prescribe dead calls', () => {
    for (const dead of ['captureError', 'trackVRSession', 'trackFPS', 'trackMemory', 'trackInteraction']) {
      expect(monSource).not.toMatch(new RegExp(`\\.${dead}\\s*\\(`));
    }
  });
});
