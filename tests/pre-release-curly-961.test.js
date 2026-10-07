const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET = path.join('tools', 'pre-release-validation.js');

function lintFile() {
  const out = execFileSync('npx', ['eslint', TARGET, '--format', 'json'], {
    cwd: ROOT,
    env: { ...process.env, ESLINT_USE_FLAT_CONFIG: 'false' },
    maxBuffer: 8 * 1024 * 1024
  }).toString();
  return JSON.parse(out)[0].messages;
}

describe('pre-release-validation.js lint honesty (#961)', () => {
  test('eslint reports zero errors on tools/pre-release-validation.js', () => {
    const errors = lintFile().filter((m) => m.severity === 2);
    expect(errors).toEqual([]);
  }, 120000);

  test('getScoreEmoji keeps its emoji ladder semantics', () => {
    const src = require('fs').readFileSync(path.join(ROOT, TARGET), 'utf8');
    expect(src).toContain('function getScoreEmoji(score)');
    // every ladder rung is braced — no unbraced `if (...) return` statements
    expect(src).not.toMatch(/if \(score [^)]*\) return '[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2705\u274C\uD83C-\uDBFF]/u);
    const fn = new Function(`${src.match(/function getScoreEmoji[\s\S]*?\n}/)[0]}; return getScoreEmoji;`)();
    expect(fn(100)).toBe('🏆');
    expect(fn(95)).toBe('✅');
    expect(fn(90)).toBe('👍');
    expect(fn(75)).toBe('⚠️');
    expect(fn(0)).toBe('❌');
  });
});
