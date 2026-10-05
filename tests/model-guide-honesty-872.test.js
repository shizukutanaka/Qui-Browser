const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const guide = fs.readFileSync(path.join(ROOT, 'docs/MODEL_GUIDE.md'), 'utf8');
const pkg = require('../package.json');

describe('docs/MODEL_GUIDE.md prescriptive guidance stays honest about repo state', () => {
  it('every dir the lint script covers actually exists', () => {
    const lintScript = pkg.scripts.lint;
    expect(lintScript).toContain('eslint');
    const lintArgs = lintScript.split(/\s+/).slice(-2); // trailing args are the lint targets
    for (const target of lintArgs) {
      expect(fs.existsSync(path.join(ROOT, target))).toBe(true);
    }
  });

  it('lint coverage claims in the guide match the actual lint script', () => {
    const lintScript = pkg.scripts.lint;
    // The guide must not describe lint coverage for directories the script
    // no longer covers (e.g. the deleted server/ backend).
    expect(lintScript).not.toMatch(/server/);
    expect(guide).not.toMatch(/lintスクリプトに追加済み(?!だった)/);
  });

  it('references to deleted directories are marked as historical', () => {
    // server/ and api/ were deleted; the guide may cite them as past-session
    // examples only when flagged 当時/削除済み.
    const lines = guide.split('\n').filter((l) => /server\/|api\/|assets\/js\//.test(l));
    for (const line of lines) {
      expect(line).toMatch(/当時|削除済み|過去/);
    }
  });
});
