/**
 * Class-pinning test for the stale-docs class (#1152 / #1162 same shape):
 * comments and examples must only describe API surface that exists.
 *
 * ComfortSystem.js's trailing "Usage Example" prescribed
 * `comfort.render(scene, camera)` — a method that was never implemented and
 * that the file's own docstring says never reached the display. Copy-pasting
 * it throws `comfort.render is not a function`. JSDoc/examples may only name
 * methods the class actually defines.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../src/vr/comfort/ComfortSystem.js');

describe('ComfortSystem doc/API consistency', () => {
  const src = fs.readFileSync(FILE, 'utf8');

  // Methods actually defined on the class (name( at class-body indentation).
  const definedMethods = new Set(
    [...src.matchAll(/^ {2}(?:async )?(?:get |set )?([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1])
  );

  test('class defines an update() but no render() method', () => {
    expect(definedMethods.has('update')).toBe(true);
    expect(definedMethods.has('render')).toBe(false);
  });

  test('no comment/example prescribes calling a non-existent method', () => {
    // Extract comment blocks and find `comfort.<name>(` / `comfortSystem.<name>(` call shapes.
    const comments = [...src.matchAll(/\/\*\*[\s\S]*?\*\/|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)].map((m) => m[0]);
    const offenders = [];
    for (const c of comments) {
      for (const m of c.matchAll(/\b(?:comfort|comfortSystem)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
        if (!definedMethods.has(m[1])) {
          offenders.push(`${m[1]}()`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
