/**
 * Deploy-surface honesty — only one workflow may deploy GitHub Pages,
 * it must serve the built dist/, and dependabot.yml must be valid
 * config (no placeholder identities, no unknown schema keys).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WF = path.join(ROOT, '.github', 'workflows');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const workflows = () => fs.readdirSync(WF).filter((f) => /\.ya?ml$/.test(f));

describe('GitHub Pages deploy surface', () => {
  test('only one workflow deploys to GitHub Pages', () => {
    const deployers = workflows().filter((f) =>
      /deploy-pages|actions-gh-pages/.test(read(path.join('.github', 'workflows', f)))
    );
    expect(deployers).toEqual(['cd.yml']);
  });

  test('only one workflow creates GitHub releases', () => {
    const releasers = workflows().filter((f) =>
      read(path.join('.github', 'workflows', f)).includes('action-gh-release')
    );
    expect(releasers).toEqual(['cd.yml']);
  });

  test('no workflow publishes raw repo source to the gh-pages branch', () => {
    for (const f of workflows()) {
      const text = read(path.join('.github', 'workflows', f));
      if (/actions-gh-pages/.test(text)) {
        expect(text).toMatch(/publish_dir:\s*['"]?dist/);
      }
    }
  });

  test('every Pages artifact upload ships the built dist/, never repo root', () => {
    for (const f of workflows()) {
      const text = read(path.join('.github', 'workflows', f));
      const uploads = text.match(/upload-pages-artifact@[\s\S]{0,120}path:\s*['"]?([^'"\n]+)['"]?/g) || [];
      for (const u of uploads) {
        expect(u).not.toMatch(/path:\s*['"]?\.['"]?\s*$/m);
        expect(u).toContain('dist');
      }
      // A workflow that uploads a Pages artifact must also build it
      if (text.includes('upload-pages-artifact')) {
        expect(text).toMatch(/npm run build/);
      }
    }
  });

  test('no workflow performs an npm-install fallback that hides lockfile drift', () => {
    for (const f of workflows()) {
      const text = read(path.join('.github', 'workflows', f));
      if (text.includes('upload-pages-artifact')) {
        expect(text).not.toMatch(/npm ci \|\| npm install/);
      }
    }
  });
});

describe('dependabot.yml', () => {
  const dep = () => read('.github/dependabot.yml');

  test('has no placeholder usernames', () => {
    expect(dep()).not.toMatch(/yourusername/);
  });

  test('uses only real dependabot schema keys per update', () => {
    const text = dep();
    const bad = text.match(/^\s+automerge:/m);
    expect(bad).toBeNull();
  });

  test('reviewers/assignees resolve to a real account', () => {
    const text = dep();
    for (const m of text.matchAll(/-\s+"([^"]+)"/g)) {
      expect(m[1]).not.toBe('yourusername');
    }
    expect(text).toContain('shizukutanaka');
  });
});
