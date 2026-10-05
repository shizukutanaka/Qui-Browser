/**
 * Dead-surface pin (round 930): every CSS custom property declared in
 * main.css's :root must be referenced by a var(--name) call somewhere in the
 * shipped surface (main.css itself, index.html, src/, public/, tools/, proxy/).
 * A --token with zero var() consumers is a write-only design token — config
 * that describes a surface nothing can reach.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src', 'styles', 'main.css'), 'utf8');

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

function stripComments(text, ext) {
  let t = text.replace(/\/\*[\s\S]*?\*\//g, '');
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    t = t
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');
  }
  return t;
}

describe('CSS custom properties are referenced (dead-token surface)', () => {
  const declared = [...new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))];

  test('every declared --token is consumed by a var() call', () => {
    const consumers = [];
    for (const dir of ['src', 'public', 'tools', 'proxy']) {
      walk(path.join(root, dir), consumers);
    }
    consumers.push(path.join(root, 'index.html'));

    const corpus = consumers
      .filter((f) => /\.(css|html|js|mjs|cjs)$/.test(f))
      .map((f) => stripComments(fs.readFileSync(f, 'utf8'), path.extname(f)))
      .join('\n');

    const dead = declared.filter((name) => !corpus.includes(`var(${name}`) && !corpus.includes(`var( ${name}`));
    expect(dead).toEqual([]);
  });

  test('the five removed tokens stay removed', () => {
    const banned = ['--color-danger', '--color-success', '--color-surface-elevated', '--color-warning', '--font-mono'];
    const present = banned.filter((name) => declared.includes(name));
    expect(present).toEqual([]);
  });
});
