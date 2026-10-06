/**
 * Round 852 — dead-workflow invariant: every `paths:` trigger filter in a CI
 * workflow must reference a path that exists in the repo (a directory prefix
 * like `wasm/**` that no longer resolves means the workflow can never fire —
 * dead surface), and the wasm-build workflow (whose entire crate was deleted
 * at PR #633) must be gone.
 */
const { readFileSync, readdirSync, existsSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const wfDir = join(root, '.github/workflows');

const workflowFiles = readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f));

/** `paths:` list entries — captures lines like `- 'wasm/**'` under a paths: key. */
function pathFilters(file) {
  const lines = readFileSync(join(wfDir, file), 'utf8').split('\n');
  const filters = [];
  let inPaths = false;
  for (const line of lines) {
    if (/^\s*paths(-ignore)?:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (inPaths) {
      const m = line.match(/^\s*-\s*['"]?([^'"\s]+)['"]?\s*$/);
      if (m) {
        filters.push(m[1]);
        continue;
      }
      inPaths = false;
    }
  }
  return filters;
}

describe('workflow path filters stay live', () => {
  test('every dir-prefix `paths:` filter in every workflow resolves to an existing path', () => {
    const dead = [];
    for (const file of workflowFiles) {
      for (const filter of pathFilters(file)) {
        const base = filter.replace(/\/?\*\*$/, '').replace(/\*.*$/, '');
        if (!base || base.startsWith('.')) continue; // .github/... always exists
        if (!existsSync(join(root, base))) {
          dead.push(`${file}: ${filter}`);
        }
      }
    }
    expect(dead).toEqual([]);
  });

  test('wasm-build.yml is gone — its crate was deleted at #633 so it could never trigger', () => {
    expect(existsSync(join(wfDir, 'wasm-build.yml'))).toBe(false);
  });
});
