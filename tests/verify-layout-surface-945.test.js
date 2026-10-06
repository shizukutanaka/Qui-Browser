/**
 * verify-text-layout.mjs module-surface honesty.
 *
 * The harness page imports the app's layout modules by URL inside a template
 * string and reads them through namespace access (`caption.CAPTION_TEXT_W`).
 * That import surface is invisible to symbol-level dead-export analysis — a
 * dead-export sweep removed `export` from five constants the tool reads, and
 * every affected check then compares widths against `undefined` and reports
 * OVERFLOW: `npm run verify:layout` cannot pass.
 *
 * This test derives the requirement from the tool's own source: the module
 * list from its `import('${origin}/...')` calls, the namespace bindings from
 * its Promise.all destructure, and every `ns.SYMBOL` access in the page
 * script. Any future removal of an export the tool reads fails here.
 */
const { readFileSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const TOOL = join(ROOT, 'tools', 'verify-text-layout.mjs');

function toolSurface() {
  const src = readFileSync(TOOL, 'utf8');
  const modules = [...src.matchAll(/import\('\$\{origin\}(?<path>[^']+)'\)/g)].map((m) => m.groups.path);
  const binder = src.match(/const \[(?<names>[\w, ]+)\] = await Promise\.all/);
  const names = binder ? binder.groups.names.split(',').map((n) => n.trim()) : [];
  const accesses = {};
  for (const m of src.matchAll(/\b(?<ns>\w+)\.(?<sym>[A-Za-z_$][\w$]*)/g)) {
    const { ns, sym } = m.groups;
    if (!names.includes(ns)) {
      continue;
    }
    (accesses[ns] ||= new Set()).add(sym);
  }
  return { modules, names, accesses };
}

describe('verify-text-layout.mjs module-surface honesty', () => {
  test('the page script binds a namespace per imported module', () => {
    const { modules, names } = toolSurface();
    expect(modules.length).toBeGreaterThan(0);
    expect(names.length).toBe(modules.length);
  });

  test('every symbol the tool reads is actually exported by its module', () => {
    const { modules, names, accesses } = toolSurface();
    const missing = [];
    for (let i = 0; i < names.length; i++) {
      const ns = names[i];
      const mod = require(join(ROOT, modules[i]));
      for (const sym of accesses[ns] || []) {
        if (mod[sym] === undefined) {
          missing.push(`${ns}.${sym} (read from ${modules[i]})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
