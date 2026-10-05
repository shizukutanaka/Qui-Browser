import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const doc = readFileSync(join(__dirname, '../docs/DEVELOPER_ONBOARDING.md'), 'utf8');

describe('DEVELOPER_ONBOARDING.md tree matches the repo', () => {
  test('workflow tree only lists real workflow files', () => {
    const workflows = readdirSafe(join(__dirname, '../.github/workflows'));
    for (const f of ['ci.yml', 'cd.yml']) {
      expect(workflows).toContain(f);
    }
    expect(workflows).not.toContain('deploy.yml');
    expect(workflows).not.toContain('release.yml');
    // The tree must not prescribe deleted workflow files
    for (const line of doc.split('\n')) {
      if (/├──|└──|│/.test(line) && /\.yml/.test(line)) {
        const name = line.match(/([a-z-]+\.yml)/)?.[1];
        if (name) {
          expect(workflows).toContain(name);
        }
      }
    }
  });

  test('no stale workflow filename mentioned in the tree', () => {
    const treeStart = doc.indexOf('.github/');
    expect(treeStart).toBeGreaterThan(-1);
    const treeEnd = doc.indexOf('```', treeStart);
    const tree = doc.slice(treeStart, treeEnd === -1 ? treeStart + 800 : treeEnd);
    expect(tree).not.toContain('deploy.yml');
    expect(tree).not.toContain('release.yml');
  });
});

function readdirSafe(dir) {
  try {
    return require('fs').readdirSync(dir);
  } catch {
    return [];
  }
}
