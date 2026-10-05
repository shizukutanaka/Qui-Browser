const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function runEslint() {
  const out = execFileSync('npx', ['eslint', 'src', 'proxy', '--format', 'json'], {
    cwd: ROOT,
    env: { ...process.env, ESLINT_USE_FLAT_CONFIG: 'false' },
    maxBuffer: 32 * 1024 * 1024
  }).toString();
  return JSON.parse(out);
}

describe('lint baseline', () => {
  test('eslintrc delegates indentation to prettier (no indent rule)', () => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, '.eslintrc.json'), 'utf8'));
    expect(config.rules.indent).toBeUndefined();
  });

  test('eslint reports zero errors on linted sources', () => {
    const results = runEslint();
    const errors = results.flatMap((f) => f.messages.filter((m) => m.severity === 2));
    expect(errors).toEqual([]);
  }, 120000);

  test('build output and coverage are excluded from lint', () => {
    const ignore = fs.readFileSync(path.join(ROOT, '.eslintignore'), 'utf8');
    const entries = ignore
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    expect(entries).toContain('dist/');
    expect(entries).toContain('coverage/');
  });
});
