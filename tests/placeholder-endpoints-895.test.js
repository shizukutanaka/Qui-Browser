const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Live docs only — docs/archive/* and the dated release/summary snapshots are
// historical records, not guidance to follow.
const LIVE_DOCS = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'RELEASE_CHECKLIST.md',
  'PROJECT_STATUS.md',
  '.github/DISCUSSION_TEMPLATES.md'
]
  .concat(
    fs
      .readdirSync(path.join(ROOT, 'docs'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => `docs/${f}`)
  )
  .filter((f) => fs.existsSync(path.join(ROOT, f)));

// Placeholder tokens that describe an endpoint nobody controls. Generic
// '<user>'-style fill-ins (e.g. /path/to/, example.com inside a template
// example) are legitimate and stay out.
const PLACEHOLDERS = [/yourusername/i, /your-username/i, /your-org/i, /your-repo/i];

describe('live docs declare no placeholder endpoints', () => {
  for (const doc of LIVE_DOCS) {
    test(`${doc}`, () => {
      const text = fs.readFileSync(path.join(ROOT, doc), 'utf8');
      for (const re of PLACEHOLDERS) {
        const m = text.match(re);
        expect(m && `${doc}: '${m[0]}'`).toBeNull();
      }
    });
  }
});
