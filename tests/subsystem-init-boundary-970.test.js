/**
 * Pin tests (round 970): the optional-subsystem error boundary has two
 * stragglers that sit outside the constructor sites pinned by
 * subsystem-init-boundary-969.
 *
 * 1. DevTools is loaded via `await import('../dev/DevTools.js')` inside
 *    initializeSystems() — guarded by `import.meta.env.DEV`, so it only affects
 *    development builds, but a failed chunk load or ctor throw there rejects
 *    initializeSystems() → fire-and-forget initialize() drops it → the render
 *    loop never arms → black screen.
 * 2. `onVRSessionStart()` awaits `this.handTracking.initialize(session)`
 *    bare. A throw/rejection propagates to the 'sessionstart' event listener
 *    (unhandled rejection) and skips everything after it — including
 *    renderer.setPixelRatio(1) and the WCAG 4.1.3 'vr ready' caption.
 *
 * These pins assert the sibling pattern from 969/Session-2: the call site sits
 * inside a try whose catch reports the failure and degrades the field to null
 * so every downstream null-guard keeps working.
 */

const fs = require('fs');
const path = require('path');

const VRSRC = path.join(__dirname, '..', 'src', 'vr', 'VRApp.js');
const I18NSRC = path.join(__dirname, '..', 'src', 'i18n', 'i18n.js');
const source = fs.readFileSync(VRSRC, 'utf8');
const i18n = fs.readFileSync(I18NSRC, 'utf8');

/**
 * Minimal brace scanner (same as subsystem-init-boundary-969): walks the
 * source once and records, for every `try {` block, its [openBraceIndex,
 * closeBraceIndex] span plus the span of its `catch` clause.
 * Returns { tryStart, tryEnd, catchStart, catchEnd }[].
 */
function tryBlocks(source) {
  const blocks = [];
  const stack = []; // {isTry, index}
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    // skip line comments, block comments, and string literals so braces
    // inside them cannot corrupt the depth count
    if (ch === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') {
        i++;
      }
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        i++;
      }
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      i++;
      while (i < n && source[i] !== q) {
        if (source[i] === '\\') {
          i++;
        }
        i++;
      }
      i++;
      continue;
    }
    if (ch === '{') {
      // is this brace directly preceded by the `try` keyword?
      let j = i - 1;
      while (j >= 0 && /\s/.test(source[j])) {
        j--;
      }
      const isTry = j >= 2 && source.slice(j - 2, j + 1) === 'try' && !/[A-Za-z0-9_$]/.test(source[j - 3] || '');
      stack.push({ isTry, index: i });
      i++;
      continue;
    }
    if (ch === '}') {
      const top = stack.pop();
      if (top && top.isTry) {
        // find the matching catch clause immediately after
        let j = i + 1;
        while (j < n && /\s/.test(source[j])) {
          j++;
        }
        let catchStart = -1,
          catchEnd = -1;
        if (source.slice(j, j + 5) === 'catch') {
          catchStart = j;
          // skip `catch (...) {` to the opening brace
          let k = j + 5;
          while (k < n && /\s/.test(source[k])) {
            k++;
          }
          if (source[k] === '(') {
            let depth = 0;
            while (k < n && (source[k] !== ')' || --depth > 0)) {
              if (source[k] === '(') {
                depth++;
              }
              k++;
            }
            k++;
          }
          while (k < n && /\s/.test(source[k])) {
            k++;
          }
          if (source[k] === '{') {
            let depth = 1;
            k++;
            while (k < n && depth > 0) {
              if (source[k] === '{') {
                depth++;
              } else if (source[k] === '}') {
                depth--;
              }
              k++;
            }
            catchEnd = k;
          }
        }
        blocks.push({ tryStart: top.index, tryEnd: i, catchStart, catchEnd });
      }
      i++;
      continue;
    }
    i++;
  }
  return blocks;
}

const blocks = tryBlocks(source);
const enclosingTry = (index) => blocks.find((b) => b.tryStart < index && index < b.tryEnd);

describe('subsystem-init-boundary-970 — session-side stragglers', () => {
  describe('DevTools dynamic import (initializeSystems, dev builds)', () => {
    const siteIdx = source.indexOf("await import('../dev/DevTools.js')");

    test('the dynamic import + ctor site exists', () => {
      expect(siteIdx).toBeGreaterThan(-1);
      expect(source.indexOf('new DevTools(this)', siteIdx)).toBeGreaterThan(siteIdx);
    });

    test('the import + ctor + initialize() sit inside a try block', () => {
      const t = enclosingTry(siteIdx);
      expect(t).toBeDefined();
      expect(t.tryEnd).toBeGreaterThan(source.indexOf('new DevTools(this)', siteIdx));
    });

    test('its catch reports the failure and degrades devTools to null', () => {
      const t = enclosingTry(siteIdx);
      const catchBody = source.slice(t.catchStart, t.catchEnd);
      expect(catchBody).toContain('console.error');
      expect(catchBody).toContain('this.devTools = null');
    });
  });

  describe('handTracking.initialize(session) in onVRSessionStart', () => {
    const siteIdx = source.indexOf('await this.handTracking.initialize(');

    test('the session-init call site exists', () => {
      expect(siteIdx).toBeGreaterThan(-1);
    });

    test('the call sits inside a try block', () => {
      expect(enclosingTry(siteIdx)).toBeDefined();
    });

    test('its catch toasts handTrackingUnavailable and degrades to null', () => {
      const t = enclosingTry(siteIdx);
      const catchBody = source.slice(t.catchStart, t.catchEnd);
      expect(catchBody).toContain('showVRToast(');
      expect(catchBody).toContain("t('vr.error.handTrackingUnavailable')");
      expect(catchBody).toContain('this.handTracking = null');
    });

    test('its catch disposes the half-initialized tracker', () => {
      const t = enclosingTry(siteIdx);
      const catchBody = source.slice(t.catchStart, t.catchEnd);
      // initialize() may attach the inputsourceschange listener or create the
      // joint meshes before throwing — dispose() undoes both; skipping it leaks
      // the listener for the session's lifetime.
      expect(catchBody).toContain('dispose()');
    });

    test('gesture wiring is gated on initialize() succeeding', () => {
      // onGesture('pinch' …) registration must not run when initialize()
      // returned false (unsupported runtime) — otherwise dead callbacks are
      // registered on a tracker that will never fire.
      const pinchIdx = source.indexOf("this.handTracking.onGesture('pinch'");
      expect(pinchIdx).toBeGreaterThan(siteIdx);
      const between = source.slice(siteIdx, pinchIdx);
      expect(between).toMatch(/handsReady|initialize\(session\)\s*\)/);
      const t = enclosingTry(siteIdx);
      expect(pinchIdx).toBeLessThan(t.catchStart); // still inside the try/gated region
    });

    test('the session-ready tail still runs after the guarded block', () => {
      const t = enclosingTry(siteIdx);
      const pixelRatioIdx = source.indexOf('renderer.setPixelRatio(1)');
      const readyIdx = source.indexOf("t('vr.msg.vrReady')");
      expect(pixelRatioIdx).toBeGreaterThan(t.catchEnd);
      expect(readyIdx).toBeGreaterThan(t.catchEnd);
    });
  });

  describe('vr.error.handTrackingUnavailable catalog coverage', () => {
    test('key exists in the en catalog', () => {
      const enBlock = i18n.match(/en:\s*\{[\s\S]*?\n\s*\},\s*\n\s*ja:/);
      expect(enBlock[0]).toContain('vr.error.handTrackingUnavailable');
    });

    test('key exists in the ja catalog', () => {
      const jaBlock = i18n.match(/ja:\s*\{[\s\S]*$/);
      expect(jaBlock[0]).toContain('vr.error.handTrackingUnavailable');
    });
  });
});
