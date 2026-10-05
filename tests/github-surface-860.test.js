/**
 * .github surface honesty — CODEOWNERS must name a real account and
 * resolve every path pattern, FUNDING.yml must not be an all-empty
 * template, and community docs must not carry stale version refs.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const codeownersLines = () =>
  read('.github/CODEOWNERS')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

// Resolve a CODEOWNERS pattern to a concrete existence check: cut at the
// first glob char and require the literal prefix (dir or file) to exist.
const patternResolves = (pattern) => {
  const clean = pattern.replace(/^\//, '');
  const cut = clean.search(/[*?[]/);
  const literal = cut === -1 ? clean : clean.slice(0, cut).replace(/\/$/, '');
  if (literal === '') {
    return true; // '*' at root matches everything
  }
  return exists(literal);
};

describe('CODEOWNERS', () => {
  test('has no placeholder identities', () => {
    expect(read('.github/CODEOWNERS')).not.toMatch(/yourusername/i);
  });

  test('every owner handle is a real account', () => {
    const owners = new Set();
    for (const line of codeownersLines()) {
      for (const m of line.matchAll(/@([A-Za-z0-9-]+)/g)) {
        owners.add(m[1]);
      }
    }
    expect(owners.size).toBeGreaterThan(0);
    for (const o of owners) {
      expect(o).toBe('shizukutanaka');
    }
  });

  test('every path pattern resolves to an existing file or directory', () => {
    const bad = [];
    for (const line of codeownersLines()) {
      const pattern = line.split(/\s+/)[0];
      if (!patternResolves(pattern)) {
        bad.push(pattern);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('FUNDING.yml', () => {
  test('is absent or names at least one real funding target', () => {
    if (!exists('.github/FUNDING.yml')) {
      return;
    }
    // every key in the committed template was empty — a real file must
    // carry at least one non-empty value
    const keys =
      'github|patreon|open_collective|ko_fi|tidelift|community_bridge|' +
      'liberapay|issuehunt|otechie|lfx_crowdfunding|custom';
    const line = new RegExp(`^(${keys}):\\s*[^\\s[\\]#]+`, 'm');
    expect(read('.github/FUNDING.yml')).toMatch(line);
  });
});

describe('DISCUSSION_TEMPLATES.md', () => {
  test('references the current major version, not a phantom v5 line', () => {
    const pkg = JSON.parse(read('package.json'));
    const major = pkg.version.split('.')[0];
    const text = read('.github/DISCUSSION_TEMPLATES.md');
    const stale = text.match(/v(\d+)\.\d+\.\d+/g) || [];
    expect(stale.every((v) => v.startsWith(`v${major}`))).toBe(true);
  });
});
