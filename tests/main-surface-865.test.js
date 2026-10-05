/**
 * Round 865 — main.js honesty audit.
 *
 * Found gaps (assumption vs implementation):
 *  1. The startup console banner advertised "Experimental: WebGPU,
 *     Multiplayer, AI" — but no multiplayer, AI, or WebGPU subsystem exists
 *     in src/ (WebGPU appears only as a navigator.gpu detection probe in
 *     DeviceCompatibility, never a renderer). The banner described phantom
 *     features every developer sees on load.
 *  2. `showVRError(anchor, message)` declared an `anchor` param it never
 *     referenced — the toast is fixed bottom-center, so the signature lied
 *     to every caller about anchoring behaviour.
 *
 * These tests pin the invariants, not the instances.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const MAIN = path.join(SRC, 'main.js');

const read = (p) => fs.readFileSync(p, 'utf8');

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p);
    } else if (e.isFile() && /\.js$/.test(e.name)) {
      yield p;
    }
  }
}

describe('main.js only promises what exists', () => {
  it('the startup banner names no feature absent from src/', () => {
    const main = read(MAIN);
    const banner = main.match(/console\.debug\(`([\s\S]*?)`\)/);
    expect(banner).not.toBeNull();
    const claims = banner[1];
    // Every named technology in the banner must have a real implementation
    // surface somewhere under src/ (a class/module, not a bare probe).
    const corpus = [...walk(SRC)].map(read).join('\n');
    for (const phantom of ['Multiplayer', 'WebGPU']) {
      if (claims.includes(phantom)) {
        // If the banner claims it, something must implement it.
        expect(corpus).toMatch(new RegExp(`class .*${phantom}|${phantom.toLowerCase()}\\(\\)`, 'i'));
      }
    }
    expect(claims).not.toMatch(/AI\b/);
    expect(claims).not.toMatch(/Multiplayer/);
  });

  it('every declared parameter of a top-level helper is used in its body', () => {
    const main = read(MAIN);
    const fns = [...main.matchAll(/function (\w+)\(([^)]*)\) \{/g)];
    expect(fns.length).toBeGreaterThan(0);
    fns.forEach((m) => {
      const [, name, params] = m;
      const bodyStart = main.indexOf(m[0]) + m[0].length;
      // Take the body up to the next top-level `function`/const decl.
      const rest = main.slice(bodyStart);
      const end = rest.search(/\n(?:function|const|\/\/ |\n\/\*)/);
      const body = rest.slice(0, end === -1 ? undefined : end);
      params
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((param) => {
          expect({ name, param, used: body.includes(param) }).toEqual(expect.objectContaining({ used: true }));
        });
    });
  });
});
