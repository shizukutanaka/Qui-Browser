/**
 * Round 971 — per-frame error-boundary pin tests.
 *
 * Defect: Three.js WebGLAnimation.onAnimationFrame calls the animation loop
 * callback FIRST and re-arms requestAnimationFrame only after it returns. Any
 * exception escaping VRApp.render() — a subsystem's per-frame update throwing
 * — therefore never reaches the re-arm: the render loop dies permanently and
 * silently (frozen scene, zero user notification; WCAG 4.1.3 Status Messages,
 * same visible outcome as the init-time boot-kill class).
 *
 * Fix shape pinned here: every optional subsystem update inside
 * updateSystems() (and the draw call inside render()) runs through
 * _runPerFrame(label, fn), which isolates the fault, circuit-breaks that
 * label (first throw wins, later frames skip it — no 90 fps console spam),
 * surfaces a one-shot warn toast, and keeps siblings + the draw alive.
 * onVRSessionStart() clears the fault set so a boundary-transient fault gets
 * a second chance on re-entry.
 */

const fs = require('fs');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'src', 'vr', 'VRApp.js'), 'utf8');
const I18N = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'i18n.js'), 'utf8');

/** Extract the body of a method declared as `name(<args>) {` on VRApp. */
function methodBody(name) {
  let start = APP.indexOf(`\n  ${name}(`);
  if (start === -1) {
    start = APP.indexOf(`\n  async ${name}(`);
  }
  if (start === -1) {
    return '';
  }
  const braceOpen = APP.indexOf('{', start);
  let depth = 0;
  for (let i = braceOpen; i < APP.length; i++) {
    const ch = APP[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return APP.slice(braceOpen, i + 1);
      }
    }
  }
  return '';
}

const GUARDED_LABELS = [
  'comfortSystem',
  'ffrSystem',
  'handTracking',
  'hapticFeedback',
  'spatialAudio',
  'layersSystem',
  'locomotion',
  'buttonInput',
  'teleport',
  'hover',
  'gazeInteraction',
  'captionSystem',
  'windowManager',
  'immersiveVideo'
];

describe('per-frame error boundary (round 971)', () => {
  test('_runPerFrame helper exists on VRApp', () => {
    expect(APP).toContain('_runPerFrame(label, fn)');
  });

  test('helper guards the call with try/catch', () => {
    const body = methodBody('_runPerFrame');
    expect(body).toContain('try {');
    expect(body).toContain('catch');
  });

  test('helper circuit-breaks a faulted label before the try', () => {
    const body = methodBody('_runPerFrame');
    const hasGate = body.indexOf('_frameFaults');
    const tryIdx = body.indexOf('try {');
    expect(hasGate).toBeGreaterThan(-1);
    expect(tryIdx).toBeGreaterThan(-1);
    expect(hasGate).toBeLessThan(tryIdx);
    expect(body).toContain('.has(label)');
    expect(body).toContain('.add(label)');
  });

  test('helper surfaces the fault — console.error + one warn toast', () => {
    const body = methodBody('_runPerFrame');
    expect(body).toContain('console.error');
    expect(body).toContain('showVRToast');
    expect(body).toContain("'warn'");
    expect(body).toContain('vr.error.subsystemFailed');
  });

  test.each(GUARDED_LABELS)("updateSystems routes '%s' through _runPerFrame", (label) => {
    const body = methodBody('updateSystems');
    expect(body).toContain(`_runPerFrame('${label}'`);
  });

  test('the 4 internal input paths are wrapped, not called bare', () => {
    const body = methodBody('updateSystems');
    for (const fn of ['updateLocomotion(dt)', 'updateButtonInput()', 'updateTeleport()', 'updateHover()']) {
      expect(body).toContain(`=> this.${fn}`);
    }
  });

  test('the draw call itself is bounded — renderer.render inside _runPerFrame', () => {
    const body = methodBody('render');
    expect(body).toContain("_runPerFrame('renderer'");
    expect(body).toContain('=> this.renderer.render(');
  });

  test('onVRSessionStart clears the fault set for a second chance', () => {
    const body = methodBody('onVRSessionStart');
    expect(body).toContain('_frameFaults');
    expect(body).toContain('.clear()');
  });

  test('i18n: vr.error.subsystemFailed exists in en', () => {
    expect(I18N).toContain("'vr.error.subsystemFailed':");
  });

  test('i18n: vr.error.subsystemFailed exists in ja', () => {
    const ja = I18N.indexOf("'vr.error.subsystemFailed':");
    expect(ja).toBeGreaterThan(-1);
    // The ja catalog is the second occurrence (en first).
    const second = I18N.indexOf("'vr.error.subsystemFailed':", ja + 1);
    expect(second).toBeGreaterThan(-1);
  });
});
