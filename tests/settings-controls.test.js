/**
 * Oracle test for the Split Phase extraction of settings-panel control
 * declarations out of VRApp.createSettingsPanel() into
 * src/vr/ui/settingsControls.js.
 *
 * The oracle is the pre-split behaviour: the same pools in the same order,
 * every callback delegating to the same VRApp method with the same arguments,
 * and a section spec that places every declared control exactly once.
 */

import { buildSettingsControls, SEARCH_ENGINES, COMFORT_PRESETS } from '../src/vr/ui/settingsControls.js';
import { assignSettingsSections } from '../src/vr/ui/settingsLayout.js';
import { t } from '../src/i18n/i18n.js';

function stubApp(overrides = {}) {
  return {
    settings: {},
    _applyHighContrast: jest.fn(),
    _applyToggle: jest.fn(),
    _applyPrivateMode: jest.fn(),
    _onWebPanelToggleChanged: jest.fn(),
    _onVoiceToggleChanged: jest.fn(),
    _onHomeEnvToggleChanged: jest.fn(),
    _onDeadZoneChanged: jest.fn(),
    _launchImmersiveVideo: jest.fn(),
    _clearBrowsingHistory: jest.fn(),
    _requestReaderProxyInput: jest.fn(),
    showVRToast: jest.fn(),
    ...overrides
  };
}

const toggleByKey = (toggles, key) => toggles.find((e) => e[1] === key);
const stepperByKey = (steppers, key) => steppers.find((e) => e[1] === key);

describe('buildSettingsControls — pool declarations', () => {
  test('declares every toggle in panel order with its settings key', () => {
    const { toggles } = buildSettingsControls(stubApp());
    expect(toggles.map((e) => e[1])).toEqual([
      'highContrast',
      'enableTeleport',
      'enableSnapTurn',
      'enableSmoothMove',
      'southpaw',
      'enableComfort',
      'enableFFR',
      'enableGazeDwell',
      'enableHaptics',
      'enableCaptions',
      'enableWebPanel',
      'enableVoice',
      'enableHomeEnvironment',
      'enableWindowFollow',
      'enableCurvedPanel',
      'privateMode',
      'restoreTabs'
    ]);
    // read-at-use keys keep a null callback, exactly as before the split
    expect(toggleByKey(toggles, 'enableTeleport')[2]).toBeNull();
    expect(toggleByKey(toggles, 'enableSnapTurn')[2]).toBeNull();
    expect(toggleByKey(toggles, 'restoreTabs')[2]).toBeNull();
  });

  test('declares every stepper with identical min/max/step/unit', () => {
    const { steppers } = buildSettingsControls(stubApp());
    const pick = (key) => {
      const o = stepperByKey(steppers, key)[2];
      const { apply, ...rest } = o;
      return rest;
    };
    expect(steppers.map((e) => e[1])).toEqual([
      'snapTurnAngle',
      'smoothMoveSpeed',
      'controllerDeadZone',
      'gazeDwellTime',
      'gazeGraceTime',
      'windowDistance',
      'captionDuration',
      'captionScale',
      'captionHeight',
      'masterVolume',
      'readerTextScale'
    ]);
    expect(pick('snapTurnAngle')).toEqual({ min: 15, max: 90, step: 15, unit: '°' });
    expect(pick('smoothMoveSpeed')).toEqual({ min: 0.5, max: 4.0, step: 0.5, unit: ' m/s' });
    expect(pick('controllerDeadZone')).toEqual({ min: 0, max: 0.5, step: 0.05 });
    expect(pick('gazeDwellTime')).toEqual({ min: 500, max: 3000, step: 250, unit: 'ms' });
    expect(pick('gazeGraceTime')).toEqual({ min: 0, max: 600, step: 50, unit: 'ms' });
    expect(pick('windowDistance')).toEqual({ min: 0.6, max: 6.0, step: 0.2, unit: ' m' });
    expect(pick('captionDuration')).toEqual({ min: 2, max: 60, step: 2, unit: 's' });
    expect(pick('captionScale')).toEqual({ min: 0.5, max: 3.0, step: 0.25, unit: 'x' });
    expect(pick('captionHeight')).toEqual({ min: -0.85, max: -0.25, step: 0.1, unit: 'm' });
    expect(pick('masterVolume')).toEqual({ min: 0, max: 100, step: 10, unit: '%' });
    expect(pick('readerTextScale')).toEqual({ min: 0.5, max: 2.0, step: 0.25, unit: 'x' });
  });

  test('declares both cycles with the shared preset lists', () => {
    const { cycles } = buildSettingsControls(stubApp());
    expect(cycles.map((e) => e[1])).toEqual(['motionSensitivity', 'searchEngine']);
    expect(cycles[0][2]).toBe(COMFORT_PRESETS);
    expect(cycles[1][2]).toBe(SEARCH_ENGINES);
  });
});

describe('buildSettingsControls — callback routing', () => {
  test('toggle callbacks reach the same VRApp methods', () => {
    const app = stubApp();
    const { toggles } = buildSettingsControls(app);

    toggleByKey(toggles, 'highContrast')[2](true);
    expect(app._applyHighContrast).toHaveBeenCalledWith(true);

    for (const key of [
      'enableComfort',
      'enableFFR',
      'enableGazeDwell',
      'enableHaptics',
      'enableCaptions',
      'enableWindowFollow',
      'enableCurvedPanel'
    ]) {
      toggleByKey(toggles, key)[2](false);
      expect(app._applyToggle).toHaveBeenCalledWith(key, false);
    }

    toggleByKey(toggles, 'enableWebPanel')[2](true);
    expect(app._onWebPanelToggleChanged).toHaveBeenCalledWith(true);
    toggleByKey(toggles, 'enableVoice')[2](false);
    expect(app._onVoiceToggleChanged).toHaveBeenCalledWith(false);
    toggleByKey(toggles, 'enableHomeEnvironment')[2](true);
    expect(app._onHomeEnvToggleChanged).toHaveBeenCalledWith(true);
    toggleByKey(toggles, 'privateMode')[2](true);
    expect(app._applyPrivateMode).toHaveBeenCalledWith(true);
  });

  test('southpaw announces the primary hand through captions only when enabled', () => {
    const show = jest.fn();
    const app = stubApp({ captionSystem: { enabled: true, show } });
    const cb = toggleByKey(buildSettingsControls(app).toggles, 'southpaw')[2];
    cb(true);
    expect(show).toHaveBeenCalledWith(t('vr.msg.primaryHandLeft'));
    cb(false);
    expect(show).toHaveBeenCalledWith(t('vr.msg.primaryHandRight'));

    const app2 = stubApp({ captionSystem: { enabled: false, show } });
    toggleByKey(buildSettingsControls(app2).toggles, 'southpaw')[2](true);
    expect(show).toHaveBeenCalledTimes(2);
  });

  test('smoothMove warns only when the OS prefers reduced motion', () => {
    const app = stubApp();
    const cb = toggleByKey(buildSettingsControls(app).toggles, 'enableSmoothMove')[2];
    const prev = global.matchMedia;
    try {
      global.matchMedia = () => ({ matches: true });
      cb(true);
      expect(app.showVRToast).toHaveBeenCalledWith(expect.any(String), { type: 'warn' });
      app.showVRToast.mockClear();
      cb(false); // disabling never warns
      expect(app.showVRToast).not.toHaveBeenCalled();

      global.matchMedia = () => ({ matches: false });
      cb(true);
      expect(app.showVRToast).not.toHaveBeenCalled();
    } finally {
      global.matchMedia = prev;
    }
  });

  test('stepper apply callbacks delegate with the same transforms', () => {
    const gazeInteraction = {};
    const windowManager = { setDistance: jest.fn() };
    const captionSystem = { setLineDuration: jest.fn(), setScale: jest.fn(), setVerticalOffset: jest.fn() };
    const spatialAudio = { setMasterVolume: jest.fn() };
    const tabManager = { setReaderScale: jest.fn() };
    const app = stubApp({ gazeInteraction, windowManager, captionSystem, spatialAudio, tabManager });
    const { steppers } = buildSettingsControls(app);
    const apply = (key, v) => stepperByKey(steppers, key)[2].apply(v);

    apply('controllerDeadZone', 0.2);
    expect(app._onDeadZoneChanged).toHaveBeenCalledWith(0.2);
    apply('gazeDwellTime', 1500);
    expect(gazeInteraction.dwellTime).toBe(1500);
    apply('gazeGraceTime', 300);
    expect(gazeInteraction.graceTime).toBe(300);
    apply('windowDistance', 2.0);
    expect(windowManager.setDistance).toHaveBeenCalledWith(2.0);
    apply('captionDuration', 10);
    expect(captionSystem.setLineDuration).toHaveBeenCalledWith(10000);
    apply('captionScale', 1.5);
    expect(captionSystem.setScale).toHaveBeenCalledWith(1.5);
    apply('captionHeight', -0.5);
    expect(captionSystem.setVerticalOffset).toHaveBeenCalledWith(-0.5);
    apply('masterVolume', 80);
    expect(spatialAudio.setMasterVolume).toHaveBeenCalledWith(0.8);
    apply('readerTextScale', 1.25);
    expect(tabManager.setReaderScale).toHaveBeenCalledWith(1.25);
  });

  test('stepper apply callbacks are no-ops when the subsystem is absent', () => {
    const app = stubApp(); // no gazeInteraction/windowManager/captionSystem/spatialAudio/tabManager
    const { steppers } = buildSettingsControls(app);
    for (const key of [
      'gazeDwellTime',
      'gazeGraceTime',
      'windowDistance',
      'captionDuration',
      'captionScale',
      'captionHeight',
      'masterVolume',
      'readerTextScale'
    ]) {
      expect(() => stepperByKey(steppers, key)[2].apply(1)).not.toThrow();
    }
  });

  test('cycle callbacks delegate with subsystem guards', () => {
    const tabManager = { setSearchEngine: jest.fn() };
    const app = stubApp({ tabManager });
    const { cycles } = buildSettingsControls(app);
    cycles[0][3]('tolerant');
    expect(app._applyToggle).toHaveBeenCalledWith('motionSensitivity', 'tolerant');
    cycles[1][3]('google');
    expect(tabManager.setSearchEngine).toHaveBeenCalledWith('google');

    const app2 = stubApp(); // no tabManager
    expect(() => buildSettingsControls(app2).cycles[1][3]('bing')).not.toThrow();
  });
});

describe('buildSettingsControls — actions', () => {
  test('always declares video360, clearHistory and readerProxy; bookmarks only when the web panel is on', () => {
    const off = buildSettingsControls(stubApp({ settings: { enableWebPanel: false } }));
    expect(off.actions.map((a) => a[0])).toEqual([
      t('vr.settings.video360'),
      t('vr.settings.clearHistory'),
      t('vr.settings.readerProxy')
    ]);

    const on = buildSettingsControls(stubApp({ settings: { enableWebPanel: true } }));
    expect(on.actions.map((a) => a[0])).toEqual([
      t('vr.settings.video360'),
      t('vr.settings.clearHistory'),
      t('vr.settings.readerProxy'),
      t('vr.settings.bookmarks')
    ]);
  });

  test('action callbacks reach the same VRApp methods', () => {
    const app = stubApp();
    const { actions } = buildSettingsControls(app);
    const byLabel = (label) => actions.find((a) => a[0] === label)[1];
    byLabel(t('vr.settings.video360'))();
    expect(app._launchImmersiveVideo).toHaveBeenCalled();
    byLabel(t('vr.settings.clearHistory'))();
    expect(app._clearBrowsingHistory).toHaveBeenCalled();
    byLabel(t('vr.settings.readerProxy'))();
    expect(app._requestReaderProxyInput).toHaveBeenCalled();
  });

  test('bookmarks toggles the panel and announces the resulting state', () => {
    const show = jest.fn();
    const bookmarkPanel = {
      visible: false,
      toggle: jest.fn(function () {
        this.visible = !this.visible;
      })
    };
    const app = stubApp({
      settings: { enableWebPanel: true },
      bookmarkPanel,
      captionSystem: { enabled: true, show }
    });
    const { actions } = buildSettingsControls(app);
    const cb = actions.find((a) => a[0] === t('vr.settings.bookmarks'))[1];
    cb();
    expect(bookmarkPanel.toggle).toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith(t('vr.msg.bookmarksOpen'));
    cb();
    expect(show).toHaveBeenCalledWith(t('vr.msg.bookmarksClosed'));
  });
});

describe('buildSettingsControls — section spec coverage', () => {
  test('every declared control is placed exactly once; nothing falls into the leftover section', () => {
    for (const enableWebPanel of [false, true]) {
      const { toggles, steppers, cycles, actions, spec } = buildSettingsControls(
        stubApp({ settings: { enableWebPanel } })
      );
      const assigned = assignSettingsSections(spec, { toggles, steppers, cycles, actions });
      expect(assigned.map((s) => s.id)).not.toContain('settings.section.other');
      const placed = assigned.flatMap((s) => [...s.toggles, ...s.steppers, ...s.cycles, ...s.actions]);
      expect(placed).toHaveLength(toggles.length + steppers.length + cycles.length + actions.length);
    }
  });
});
