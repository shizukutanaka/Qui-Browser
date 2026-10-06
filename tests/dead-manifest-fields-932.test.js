const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

describe('package.json manifest honesty (round 932)', () => {
  test('declares no module entry fields — private app is never require()d', () => {
    // `main`/`module`/`types`/`bin`/`exports` describe a package entry point.
    // This app is private:true and nothing imports it as a dependency, so the
    // fields are write-only surface (and `main` pointed at an .html file,
    // which is not a valid JS entry anyway).
    const failures = [];
    for (const field of ['main', 'module', 'types', 'bin', 'exports']) {
      if (Object.prototype.hasOwnProperty.call(pkg, field)) {
        failures.push(`manifest still declares dead entry field "${field}"`);
      }
    }
    expect(failures).toEqual([]);
  });

  test('description names only features that exist in src', () => {
    // The description claimed "WebGPU, multiplayer, AI recommendations" —
    // none of which exist as modules, classes, or i18n-visible features.
    const failures = [];
    const desc = pkg.description || '';
    for (const phantom of [/webgpu/i, /multiplayer/i, /ai recommendation/i, /enterprise monitoring/i]) {
      if (phantom.test(desc)) {
        failures.push(`description still claims nonexistent feature: ${phantom}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
