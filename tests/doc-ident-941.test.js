const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

describe('live docs name only existing doc files', () => {
  it('every file-target link in docs/DEVELOPER_ONBOARDING.md resolves', () => {
    const src = read('docs/DEVELOPER_ONBOARDING.md');
    const targets = [...src.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
      .map((m) => m[1])
      .filter((t) => !/^(https?:|#|mailto:)/.test(t) && !/[\s|+?()[\]{}\\^$]/.test(t));
    const dead = targets.filter((t) => !exists(`docs/${t}`) && !exists(t));
    expect(dead).toEqual([]);
  });

  it('verify-documentation.js covers docs/DEVELOPER_ONBOARDING.md', () => {
    const { DOCUMENTATION_FILES, EXCLUDED_DOCS } = require('../tools/verify-documentation.js');
    expect(DOCUMENTATION_FILES).toContain('docs/DEVELOPER_ONBOARDING.md');
    expect(EXCLUDED_DOCS.has('docs/DEVELOPER_ONBOARDING.md')).toBe(false);
  });

  it('every *.md filename referenced in PROJECT_STATUS.md exists at root or docs/', () => {
    const names = [
      ...new Set(
        read('PROJECT_STATUS.md')
          .match(/\b[\w.-]+\.md\b/g)
          .filter((n) => n !== 'PROJECT_STATUS.md')
      )
    ];
    const dead = names.filter((n) => !exists(n) && !exists(`docs/${n}`));
    expect(dead).toEqual([]);
  });
});
