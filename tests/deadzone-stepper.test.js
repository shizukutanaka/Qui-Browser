/**
 * controllerDeadZone: persisted preference must be reachable and apply live.
 *
 * `controllerDeadZone` is persisted (default 0.15) and consumed once at
 * `new VRControllerInput({ deadZone: this.settings.controllerDeadZone })`, but
 * no write path existed — no settings row, no stepper, no voice command. Same
 * unreachable persisted-key defect class as enableWebPanel (Session 74),
 * enableVoice and enableHomeEnvironment.
 *
 * The fix exposes a stepper in the settings panel's locomotion section whose
 * apply callback writes `controllerInput.deadZone`. The input layer reads that
 * field every frame (`applyRadialDeadZone`), so the change applies live — no
 * rebuild needed. Motor-impaired users (tremor) widen the dead zone to absorb
 * thumbstick jitter; precision users narrow it (WCAG 2.2.1 class, same as the
 * gaze grace-time stepper).
 *
 * VRApp is driven via the established convention: `VRApp.prototype` bound to a
 * hand-built `this` (a real `new VRApp()` needs a GPU).
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

global.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      fillText: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: ''
    })
  }),
  documentElement: { lang: 'en' }
};

const fs = require('fs');
const path = require('path');
const { VRApp } = require('../src/vr/VRApp.js');
const { setLanguage, t } = require('../src/i18n/i18n.js');

const SRC = fs.readFileSync(path.join(__dirname, '../src/vr/VRApp.js'), 'utf8');

afterEach(() => setLanguage('en'));

describe('_onDeadZoneChanged', () => {
  test('writes controllerInput.deadZone live', () => {
    const app = { controllerInput: { deadZone: 0.15 } };
    VRApp.prototype._onDeadZoneChanged.call(app, 0.3);
    expect(app.controllerInput.deadZone).toBe(0.3);
  });

  test('tolerates a missing controllerInput (pre-session call)', () => {
    const app = { controllerInput: null };
    expect(() => VRApp.prototype._onDeadZoneChanged.call(app, 0.3)).not.toThrow();
  });
});

describe('settings-panel reachability', () => {
  test('steppers array has a controllerDeadZone entry wired to the live-apply callback', () => {
    expect(SRC).toMatch(/'controllerDeadZone',\s*\{[^}]*apply:\s*\(v\)\s*=>\s*this\._onDeadZoneChanged\(v\)/);
  });

  test('locomotion section includes the dead-zone stepper', () => {
    expect(SRC).toMatch(/byKey\(steppers,\s*\['snapTurnAngle',\s*'smoothMoveSpeed',\s*'controllerDeadZone'\]\)/);
  });
});

describe('i18n', () => {
  test('vr.settings.deadZone resolves in English', () => {
    setLanguage('en');
    expect(t('vr.settings.deadZone')).not.toBe('vr.settings.deadZone');
  });

  test('vr.settings.deadZone resolves in Japanese', () => {
    setLanguage('ja');
    expect(t('vr.settings.deadZone')).not.toBe('vr.settings.deadZone');
  });
});
