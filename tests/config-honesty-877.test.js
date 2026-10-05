/**
 * Round 877 — config surface must not describe a surface that does not exist.
 *
 * Class pins, not instance pins:
 *  1. Every glob section in .editorconfig must match at least one tracked file.
 *     A `[Makefile]` section in a repo with no Makefile is dead config.
 *  2. .prettierrc.json must not carry JSX-scoped keys while the repo has zero
 *     JSX/TSX sources (jsxSingleQuote, jsxBracketSameLine, bracketSameLine).
 *  3. src/app.js must not log behavior claims it never performs — a listener
 *     that only logs "reducing/resuming activity" fakes a pause/resume path.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EDITORCONFIG = fs.readFileSync(path.join(ROOT, '.editorconfig'), 'utf8');
const PRETTIERRC = JSON.parse(fs.readFileSync(path.join(ROOT, '.prettierrc.json'), 'utf8'));
const APPJS = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.devin-files']);
function* repoFiles(dir = ROOT) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* repoFiles(full);
    } else if (entry.isFile()) {
      yield path.relative(ROOT, full).replace(/\\/g, '/');
    }
  }
}
const FILES = [...repoFiles()];

/** Minimal editorconfig-glob -> RegExp source (supports *, **, ?, {a,b}). */
function expandGlob(glob) {
  let out = '';
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i += 2;
      } else {
        out += '[^/]*';
        i += 1;
      }
    } else if (ch === '?') {
      out += '[^/]';
      i += 1;
    } else if (ch === '{') {
      const end = glob.indexOf('}', i);
      const alts = glob
        .slice(i + 1, end)
        .split(',')
        .map(expandGlob);
      out += `(?:${alts.join('|')})`;
      i = end + 1;
    } else {
      out += ch.replace(/[.+^$()|[\]\\]/g, '\\$&');
      i += 1;
    }
  }
  return out;
}
function globToRegExp(glob) {
  return new RegExp(`^${expandGlob(glob)}$`);
}

function editorConfigSections(text) {
  const sections = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (m) {
      sections.push(m[1]);
    }
  }
  return sections;
}

describe('config surface honesty', () => {
  test('every .editorconfig glob section matches a real file', () => {
    for (const glob of editorConfigSections(EDITORCONFIG)) {
      const re = globToRegExp(glob);
      const hit = FILES.some((f) => (glob.includes('/') ? re.test(f) : re.test(path.basename(f))));
      expect({ glob, hit }).toEqual({ glob, hit: true });
    }
  });

  test('prettier config carries no JSX-scoped keys without JSX sources', () => {
    const hasJsx = FILES.some((f) => /\.(jsx|tsx)$/.test(f));
    const jsxKeys = ['jsxSingleQuote', 'jsxBracketSameLine', 'bracketSameLine'].filter(
      (k) => PRETTIERRC[k] !== undefined
    );
    expect(hasJsx ? [] : jsxKeys).toEqual([]);
  });

  test('app.js logs no activity claims it never performs', () => {
    expect(APPJS).not.toMatch(/reducing activity|resuming activity/);
  });
});
