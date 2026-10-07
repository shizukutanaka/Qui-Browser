/**
 * Pin tests: the app entry path (src/app.js) must not let a rejected
 * capability probe escape initializeApp() as an unhandled rejection.
 *
 * Defect class: `await navigator.xr.isSessionSupported('immersive-vr')` sat
 * OUTSIDE the try/catch that guards `new VRApp(...)`, while initializeApp()
 * is invoked bare (return value dropped). A rejecting probe therefore
 * produced an unhandled rejection and silently skipped app initialization —
 * no error screen, no VRApp — whereas the sibling failure mode (a throwing
 * VRApp constructor) correctly routes to showError(). The repo already
 * treats this exact API as fallible: DeviceCompatibility.check() wraps the
 * same call in `.catch(() => false)`.
 *
 * Structural pins mirror the established test style in this repo: they read
 * the module source and assert the guard exists.
 */

const fs = require('fs');
const path = require('path');

const APP_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const MAIN_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');

/** Extract the body of `async function initializeApp()`. */
function initializeAppBody(src) {
  const start = src.indexOf('async function initializeApp(');
  expect(start).toBeGreaterThanOrEqual(0);
  // brace-match from the opening `{`
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
  throw new Error('unbalanced braces in initializeApp');
}

describe('app.js boot boundary', () => {
  const body = initializeAppBody(APP_SRC);

  test('every isSessionSupported await is rejection-guarded', () => {
    // Each statement containing the probe must either carry its own .catch
    // (DeviceCompatibility precedent) or live inside a try block.
    const stmtRe = /[^;]*isSessionSupported\([^)]*\)[^;]*;/g;
    const stmts = body.match(stmtRe) || [];
    expect(stmts.length).toBeGreaterThan(0);
    for (const s of stmts) {
      const idx = body.indexOf(s);
      const hasOwnCatch = /\.catch\s*\(/.test(s);
      const tryBefore = body.lastIndexOf('try', idx);
      const braceDepthIsInsideTry =
        tryBefore >= 0 && body.slice(tryBefore, idx).split('{').length > body.slice(tryBefore, idx).split('}').length;
      expect(hasOwnCatch || braceDepthIsInsideTry).toBe(true);
    }
  });

  test('probe rejection degrades to "unsupported" (landing page stays alive)', () => {
    // The guard must turn a rejection into a falsy value so the existing
    // `!isVRSupported` early-return (console.warn + landing page) handles it —
    // matching DeviceCompatibility.check()'s `.catch(() => false)`.
    expect(/isSessionSupported\('immersive-vr'\)\s*\.catch\(\s*\(\)\s*=>\s*false\s*\)/.test(body)).toBe(true);
  });

  test('the "not supported" early-return contract is preserved', () => {
    expect(body).toContain('Immersive VR not supported');
    expect(/if \(!isVRSupported\) \{[^}]*return;[^}]*\}/.test(body.replace(/\s+/g, ' '))).toBe(true);
  });

  test('VRApp construction stays inside its error-boundary', () => {
    // showError() must remain the handler for a throwing `new VRApp(...)`.
    expect(/try \{[\s\S]*new VRApp\(container\)[\s\S]*\} catch[\s\S]*showError\(/.test(body)).toBe(true);
  });
});

describe('main.js module-load boundary', () => {
  test("import('./app.js') chain terminates in .catch", () => {
    // Regression pin (already true): a chunk-load failure must surface as the
    // error box with a reload button, not an unhandled rejection.
    const chain = MAIN_SRC.match(/import\('\.\/app\.js'\)[\s\S]*?\.catch\s*\(/);
    expect(chain).not.toBeNull();
  });
});
