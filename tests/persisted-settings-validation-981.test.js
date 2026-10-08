/**
 * Round-981 invariants: persisted settings must be type-checked per key, not
 * just name-whitelisted.
 *
 * loadPersistedSettings accepts any value for a *known* key, so a corrupt or
 * hand-edited localStorage entry injects wrong-typed values into
 * this.settings: a string `windowDistance` turns layout math into NaN and the
 * panels vanish; a string `gazeDwellTime` makes dwell comparisons bogus; a
 * string where `openSettingsSections` expects an array breaks `.includes`-style
 * lookups. The whitelist comment promises "malformed entries cannot inject
 * arbitrary fields" — but it only guards the *key*, not the *value*.
 *
 * The fix must validate each persisted value against the declared default's
 * type — while still accepting legitimate falsy values (`0`, `false`, `''`,
 * `[]`), which are real user choices a truthiness check would clobber.
 */

jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({
  VRButton: { createButton: () => ({}) }
}));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: class {
    createControllerModel() {
      return {};
    }
  }
}));

const fs = require('fs');
const path = require('path');

const VRAPP_SRC = path.join(__dirname, '..', 'src', 'vr', 'VRApp.js');
const SETTINGS_KEY = 'qui-browser:settings';

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

/** Extract the body of `name() { ... }` at method-definition indent. */
function methodBody(src, name) {
  const start = src.indexOf('\n  ' + name + '(');
  expect(start).toBeGreaterThanOrEqual(0);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') {
      depth++;
    } else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(open + 1, i);
      }
    }
  }
  throw new Error('unbalanced braces in ' + name);
}

const { VRApp } = require('../src/vr/VRApp.js');

// A representative slice of the real defaults — one of each declared type.
function fakeApp() {
  return {
    settings: {
      targetFPS: 90,
      motionSensitivity: 'moderate',
      enableCaptions: false,
      privateMode: false,
      gazeDwellTime: 1500,
      captionScale: 1.0,
      windowDistance: 2.0,
      masterVolume: 100,
      readerProxyUrl: '',
      openSettingsSections: ['settings.section.a11y']
    }
  };
}

function loadWith(app, stored) {
  if (stored !== undefined) {
    localStorage.setItem(SETTINGS_KEY, stored);
  }
  return VRApp.prototype.loadPersistedSettings.call(app);
}

describe('persisted settings: type validation', () => {
  test('wrong-typed values are dropped instead of injected', () => {
    const app = fakeApp();
    const out = loadWith(
      app,
      JSON.stringify({
        windowDistance: 'far', // number expected
        gazeDwellTime: 'abc', // number expected
        captionScale: null, // number expected
        enableCaptions: 'yes', // boolean expected
        privateMode: 1, // boolean expected
        openSettingsSections: 'settings.section.a11y' // array expected
      })
    );
    expect(out).toEqual({});
  });

  test('legitimate falsy-but-typed values are still honoured', () => {
    const app = fakeApp();
    const out = loadWith(
      app,
      JSON.stringify({
        masterVolume: 0, // user muted audio
        privateMode: false, // explicit off
        readerProxyUrl: '', // cleared proxy
        openSettingsSections: [] // no section open
      })
    );
    expect(out).toEqual({
      masterVolume: 0,
      privateMode: false,
      readerProxyUrl: '',
      openSettingsSections: []
    });
  });

  test('well-typed values still merge and unknown keys stay dropped', () => {
    const app = fakeApp();
    const out = loadWith(
      app,
      JSON.stringify({
        gazeDwellTime: 2000,
        captionScale: 1.3,
        motionSensitivity: 'high',
        injectedEvil: true,
        anotherUnknown: 'x'
      })
    );
    expect(out).toEqual({
      gazeDwellTime: 2000,
      captionScale: 1.3,
      motionSensitivity: 'high'
    });
  });

  test('malformed or non-object JSON still falls back to {}', () => {
    const app = fakeApp();
    expect(loadWith(app, 'not json{{{')).toEqual({});
    expect(loadWith(app, '42')).toEqual({});
    expect(loadWith(app, '"string"')).toEqual({});
    expect(loadWith(app, 'null')).toEqual({});
  });
});

describe('structural pins on loadPersistedSettings', () => {
  const body = methodBody(read(VRAPP_SRC), 'loadPersistedSettings');

  test('the merge loop type-checks each value against its declared default', () => {
    // A bare `key in parsed` accept is the defect: the loop must compare the
    // stored value's type to the default's before copying.
    expect(body).toMatch(/typeof\s+\w+\s*!==?\s*typeof|typeof\s+def|Array\.isArray/);
  });
});
