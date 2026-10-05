// Round-920 invariant: every settings-panel builder must be reachable from the
// descriptor map that constructs the panel. `makeToggleButton` — the 512px
// full-width variant — kept a canvas builder, texture, and interactable
// registration alive with no call site once the 2-column layout switched every
// toggle to `makeCompactToggleButton`. Dead builders still get linted,
// formatted, and read as if they were reachable.
import { readFileSync } from 'fs';
import { join } from 'path';

const VRAPP = join(__dirname, '..', 'src', 'vr', 'VRApp.js');
const src = readFileSync(VRAPP, 'utf8');

describe('dead-builder honesty: settings panel button factories', () => {
  test('every make*Button method defined is invoked via this.* elsewhere', () => {
    const defined = [...src.matchAll(/^  (make\w+Button)\s*\(/gm)].map((m) => m[1]);
    expect(defined.length).toBeGreaterThan(0);
    const unreachable = defined.filter((name) => !src.includes(`this.${name}(`));
    // each entry is a builder defined but never invoked — dead panel surface
    expect(unreachable).toEqual([]);
  });

  test('the unreachable 512px makeToggleButton builder is gone', () => {
    expect(src).not.toMatch(/makeToggleButton\(label,\s*key,\s*apply\)\s*\{/);
  });

  test('the live compact toggle builder is still wired into the descriptor map', () => {
    expect(src).toMatch(/makeCompactToggleButton\(label,\s*key,\s*apply\)\s*\{/);
    expect(src).toContain('this.makeCompactToggleButton(');
  });
});
