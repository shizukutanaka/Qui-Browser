/**
 * Round 853 — stale-cleanup invariant: a committed `docs/patches/*.patch`
 * must still apply to the tree (`git apply --check`), and live docs must not
 * instruct `git am`/`git apply` on a patch file that is missing or dead.
 * The 0001 CI-cleanup patch referenced three already-deleted workflows and
 * two stale hunks, so it could never apply — dead surface alongside the
 * resolved PUBLISHING.md banner and OUTSTANDING_ISSUES K-1 entry.
 */
const { readFileSync, readdirSync, existsSync } = require('fs');
const { execSync } = require('child_process');
const { join } = require('path');

const root = join(__dirname, '..');
const patchDir = join(root, 'docs/patches');
const liveDocs = ['docs/PUBLISHING.md', 'docs/OUTSTANDING_ISSUES.md'];

describe('committed patches and their doc instructions stay live', () => {
  test('every docs/patches/*.patch applies cleanly via git apply --check', () => {
    const patches = existsSync(patchDir) ? readdirSync(patchDir).filter((f) => f.endsWith('.patch')) : [];
    const dead = [];
    for (const p of patches) {
      try {
        execSync(`git apply --check ${JSON.stringify(join('docs/patches', p))}`, {
          cwd: root,
          stdio: 'pipe'
        });
      } catch {
        dead.push(p);
      }
    }
    expect(dead).toEqual([]);
  });

  test('live docs reference no missing or unapplyable patch file', () => {
    const stale = [];
    for (const doc of liveDocs) {
      const text = readFileSync(join(root, doc), 'utf8');
      for (const m of text.matchAll(/docs\/patches\/[\w.\-]+\.patch/g)) {
        if (!existsSync(join(root, m[0]))) stale.push(`${doc}: ${m[0]}`);
      }
    }
    expect(stale).toEqual([]);
  });

  test('the unapplyable 0001 CI-cleanup patch is gone', () => {
    expect(existsSync(join(patchDir, '0001-ci-drop-assets-js-steps.patch'))).toBe(false);
  });
});
