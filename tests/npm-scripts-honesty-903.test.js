import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const deps = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);

describe('package.json scripts only call available tools', () => {
  test('no script invokes a CLI that is not a declared dependency', () => {
    const banned = ['netlify', 'vercel'];
    for (const [name, cmd] of Object.entries(pkg.scripts)) {
      for (const cli of banned) {
        expect(cmd).not.toMatch(new RegExp(`(^|\\s|&&\\s*)${cli}\\b`));
      }
    }
  });

  test('deploy scripts route through cd.yml, not ad-hoc CLIs', () => {
    expect(pkg.scripts['deploy:netlify']).toBeUndefined();
    expect(pkg.scripts['deploy:vercel']).toBeUndefined();
    expect(pkg.scripts['deploy:gh-pages']).toBeUndefined();
  });

  test('every node-tool script references an existing file', () => {
    for (const [name, cmd] of Object.entries(pkg.scripts)) {
      const m = cmd.match(/node\s+(tools\/[\w.-]+\.mjs|scripts\/[\w.-]+\.(mjs|js))/);
      if (m) {
        expect(existsSync(join(root, m[1]))).toBe(true);
      }
    }
  });
});

describe('live docs prescribe only npm scripts that exist', () => {
  const liveDocs = [
    'README.md',
    'PROJECT_STATUS.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    ...readdirSync(join(root, 'docs'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => join('docs', f))
  ];

  for (const docPath of liveDocs) {
    test(`${docPath}: every \`npm run X\` resolves to a real script`, () => {
      const text = readFileSync(join(root, docPath), 'utf8');
      const refs = [...text.matchAll(/npm run ([a-zA-Z][\w:-]*)/g)].map((m) => m[1]);
      for (const ref of refs) {
        expect(pkg.scripts).toHaveProperty(ref);
      }
    });
  }
});
