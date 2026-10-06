const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Live user-facing surfaces whose links/contacts must point at real endpoints.
const LIVE_DOCS = [
  'README.md',
  'PROJECT_STATUS.md',
  'RELEASE_CHECKLIST.md',
  'FINAL_RELEASE_SUMMARY_v2.0.0.md',
  'docs/CI_CD_MONITORING_GUIDE.md',
  'docs/DEPLOYMENT_GUIDE.md',
  'tools/pre-release-validation.js'
];

// Placeholder endpoints that were never provisioned: template usernames,
// fabricated deploy URLs, and fake contact mailboxes.
const PLACEHOLDER =
  /your-username|yourusername|qui-browser\.example\.com|qui-browser-vr\.netlify\.app|qui-browser-vr\.vercel\.app/i;

describe('placeholder endpoint honesty', () => {
  test.each(LIVE_DOCS)('%s contains no placeholder endpoints', (file) => {
    const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const hits = body
      .split('\n')
      .map((line, i) => (PLACEHOLDER.test(line) ? `L${i + 1}: ${line.trim()}` : null))
      .filter(Boolean);
    expect(hits).toEqual([]);
  });

  test.each(LIVE_DOCS)('%s links to the real repo where it names GitHub', (file) => {
    const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const ghLinks = body.match(/https:\/\/github\.com\/[^\s)"']+/g) || [];
    const foreign = ghLinks.filter(
      (u) => !u.includes('shizukutanaka') && !/github\.com\/(actions|marketplace|features|topics|sponsors)/.test(u)
    );
    expect(foreign).toEqual([]);
  });
});
