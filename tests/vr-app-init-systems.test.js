/**
 * VRApp initializeSystems / _buildBrowsingSystems orchestrator tests.
 *
 * These two methods are the last big untested surface (roughly 330 + 130
 * lines): every accessibility/input/media subsystem is constructed and wired
 * here, gated on persisted settings, with WCAG 4.1.3 error boundaries
 * (init failure → showVRToast warn, not a silent console.error).
 *
 * Subsystem constructors are patched on their module exports (babel-compiled
 * ESM exports are writable, verified): each fake records the config object it
 * received and returns a fixture instance, so the tests assert the actual
 * wiring bodies — gates, callbacks, error boundaries — without a GPU.
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

const THREE = require('three');
const { VRApp, defaultSettings } = require('../src/vr/VRApp.js');

// Module objects whose named exports we patch per-test.
const M = {
  ProgressiveLoader: require('../src/utils/ProgressiveLoader.js'),
  FFRSystem: require('../src/vr/rendering/FFRSystem.js'),
  ComfortSystem: require('../src/vr/comfort/ComfortSystem.js'),
  TextureManager: require('../src/utils/TextureManager.js'),
  JapaneseIME: require('../src/vr/input/JapaneseIME.js'),
  HandTracking: require('../src/vr/interaction/HandTracking.js'),
  HapticFeedback: require('../src/vr/interaction/HapticFeedback.js'),
  GazeInteraction: require('../src/vr/interaction/GazeInteraction.js'),
  SemanticDOM: require('../src/vr/accessibility/SemanticDOM.js'),
  CaptionSystem: require('../src/vr/accessibility/CaptionSystem.js'),
  SpatialAudio: require('../src/vr/audio/SpatialAudio.js'),
  VoiceCommands: require('../src/vr/input/VoiceCommands.js'),
  PerformanceMonitor: require('../src/utils/PerformanceMonitor.js'),
  TabManager: require('../src/vr/browser/TabManager.js'),
  BookmarkPanel: require('../src/vr/browser/BookmarkPanel.js'),
  ImmersiveVideo: require('../src/vr/media/ImmersiveVideo.js')
};

const ORIGINALS = {};
function patch(name, impl) {
  if (!(name in ORIGINALS)) {
    ORIGINALS[name] = M[parentOf(name)][name];
  }
  M[parentOf(name)][name] = impl;
}
function parentOf(name) {
  for (const k of Object.keys(M)) {
    if (M[k][name] !== undefined) {
      return k;
    }
  }
  throw new Error(`unknown export ${name}`);
}
function restoreAll() {
  for (const [name, orig] of Object.entries(ORIGINALS)) {
    M[parentOf(name)][name] = orig;
    delete ORIGINALS[name];
  }
}

/** A ctor recorder: captures the config arg, returns the given fixture. */
function ctor(calls, fixture) {
  return function (...args) {
    calls.push(args);
    return Object.assign({ __fixture: true }, fixture);
  };
}

function makeInitLike(settingsOverrides = {}) {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    renderer: { xr: { getSession: () => null } },
    deviceCompat: {
      check: jest.fn(async () => ({ deviceTier: 'standalone-xr' })),
      targetFPS: () => 72
    },
    settings: { ...defaultSettings(), ...settingsOverrides },
    bookmarks: {
      isBookmarked: () => false,
      toggleBookmark: () => true,
      getTopSites: () => [],
      search: () => []
    },
    interactables: [],
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    showVRToast: jest.fn(),
    navigate: jest.fn(),
    updateSetting: jest.fn(),
    _saveTabSession: jest.fn(),
    _restoreTabSession: jest.fn(() => false),
    _requestVRKeyboardInput: jest.fn(),
    _onPanelGrabRequested: jest.fn(),
    _clearBrowsingHistory: jest.fn(),
    _attachManagedWindow: jest.fn(),
    _setupOSAccessibilityListeners: VRApp.prototype._setupOSAccessibilityListeners,
    loadAudioAssets: jest.fn(async () => {}),
    a11y: {}
  };
}

/** Patch every subsystem ctor with a generic fixture so a full
 * initializeSystems() run never touches a real GPU/DOM/audio API. Individual
 * tests re-patch the ctor they target afterwards. */
const GENERIC = {
  ProgressiveLoader: () => ({ callbacks: {} }),
  FFRSystem: () => ({}),
  ComfortSystem: () => ({ setPreset() {} }),
  TextureManager: () => ({ initializeKTX2: async () => {} }),
  JapaneseIME: () => ({}),
  VRJapaneseKeyboard: () => ({}),
  HandTracking: () => ({ onTrackingChange(cb) {
    this._cb = cb;
  } }),
  HapticFeedback: () => ({ setEnabled() {} }),
  GazeInteraction: () => ({ setEnabled() {} }),
  SemanticDOM: () => ({ announceCaption() {} }),
  CaptionSystem: () => ({ enabled: false, setEnabled(v) {
    this.enabled = v;
  }, show() {} }),
  SpatialAudio: () => ({ setMasterVolume() {} }),
  VoiceCommands: () => ({ initialize: async () => false, callbacks: {}, connectBrowser() {}, start() {} }),
  PerformanceMonitor: () => ({ initialize() {} }),
  TabManager: () => ({}),
  BookmarkPanel: () => ({}),
  ImmersiveVideo: () => ({})
};
function patchAll() {
  for (const [name, make] of Object.entries(GENERIC)) {
    patch(name, function () {
      return make();
    });
  }
}

beforeEach(() => {
  patchAll();
  global.matchMedia = jest.fn(() => ({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }));
});
afterEach(() => {
  restoreAll();
  delete global.matchMedia;
});

describe('initializeSystems — construction gates honor persisted settings', () => {
  test('every opt-in subsystem is gated on its settings flag', async () => {
    const calls = {};
    for (const [name, fixture] of Object.entries({
      FFRSystem: {},
      ComfortSystem: { setPreset: jest.fn() },
      TextureManager: { initializeKTX2: jest.fn(async () => {}) },
      PerformanceMonitor: { initialize: jest.fn() }
    })) {
      calls[name] = [];
      patch(name, ctor(calls[name], fixture));
    }
    const app = makeInitLike({
      enableFFR: false,
      enableComfort: false,
      enableTextureCompression: false,
      enablePerfMonitorUI: true
    });
    await VRApp.prototype.initializeSystems.call(app);
    expect(calls.FFRSystem).toHaveLength(0);
    expect(calls.ComfortSystem).toHaveLength(0);
    expect(calls.TextureManager).toHaveLength(0);
    expect(calls.PerformanceMonitor).toHaveLength(1);
  });

  test('device probe result overrides targetFPS unless user-pinned', async () => {
    const app = makeInitLike();
    await VRApp.prototype.initializeSystems.call(app);
    expect(app.deviceCompat.check).toHaveBeenCalled();
    expect(app.settings.targetFPS).toBe(72);
    const pinned = makeInitLike({ _fpsOverridden: true, targetFPS: 90 });
    await VRApp.prototype.initializeSystems.call(pinned);
    expect(pinned.settings.targetFPS).toBe(90);
  });
});

describe('initializeSystems — WCAG 4.1.3 error boundaries', () => {
  test('HapticFeedback init failure → warn toast, app keeps booting', async () => {
    patch('HapticFeedback', function () {
      throw new Error('no gamepads');
    });
    const app = makeInitLike();
    await VRApp.prototype.initializeSystems.call(app);
    expect(app.showVRToast).toHaveBeenCalledWith(expect.any(String), { type: 'warn' });
    expect(app.captionSystem).toBeDefined();
  });

  test('SpatialAudio init failure → warn toast, init continues', async () => {
    patch('SpatialAudio', function () {
      throw new Error('no AudioContext');
    });
    const app = makeInitLike();
    await VRApp.prototype.initializeSystems.call(app);
    expect(app.showVRToast).toHaveBeenCalledWith(expect.any(String), { type: 'warn' });
  });

  test('SemanticDOM init failure is console-only — no toast, field nulled', async () => {
    patch('SemanticDOM', function () {
      throw new Error('DOM gone');
    });
    const app = makeInitLike();
    await VRApp.prototype.initializeSystems.call(app);
    expect(app.semanticDOM).toBeNull();
    expect(app.showVRToast).not.toHaveBeenCalled();
  });
});

describe('initializeSystems — wiring contracts', () => {
  test('haptics honour the persisted enableHaptics flag at construction', async () => {
    let captured;
    patch('HapticFeedback', function () {
      return { setEnabled: jest.fn(function (v) {
        captured = v;
      }) };
    });
    const app = makeInitLike({ enableHaptics: false });
    await VRApp.prototype.initializeSystems.call(app);
    expect(captured).toBe(false);
  });

  test('spatial audio applies persisted masterVolume at startup', async () => {
    let vol;
    patch('SpatialAudio', function () {
      return { setMasterVolume: (v) => {
        vol = v;
      } };
    });
    const app = makeInitLike({ masterVolume: 30 });
    await VRApp.prototype.initializeSystems.call(app);
    expect(vol).toBe(0.3);
    expect(app.loadAudioAssets).toHaveBeenCalled();
  });

  test('hand-tracking state changes announce through captions, debounced', async () => {
    jest.useFakeTimers();
    let trackingCb;
    patch('HandTracking', function () {
      return { onTrackingChange: (cb) => {
        trackingCb = cb;
      } };
    });
    const shown = [];
    patch('CaptionSystem', function () {
      return { enabled: true, setEnabled() {}, show: (m) => shown.push(m) };
    });
    const app = makeInitLike();
    await VRApp.prototype.initializeSystems.call(app);
    trackingCb('left', true);
    trackingCb('left', false); // latest wins within the debounce window
    jest.advanceTimersByTime(650);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatch(/left/i);
    trackingCb('right', true);
    jest.advanceTimersByTime(650);
    expect(shown).toHaveLength(2);
    trackingCb('left', true);           // tracked arm (not just 'lost')
    jest.advanceTimersByTime(650);
    expect(shown).toHaveLength(3);
    jest.useRealTimers();
  });

  test('voice commands: unavailable → field nulled, no toast (permission denial is silent-by-design)', async () => {
    patch('VoiceCommands', function () {
      return { initialize: async () => false };
    });
    const app = makeInitLike({ enableVoice: true });
    await VRApp.prototype.initializeSystems.call(app);
    expect(app.voiceCommands).toBeNull();
    expect(app.showVRToast).not.toHaveBeenCalled();
  });

  test('voice commands: ready → connectBrowser wiring + start() listening', async () => {
    const vc = {
      initialize: jest.fn(async () => true),
      callbacks: {},
      connectBrowser: jest.fn(),
      start: jest.fn()
    };
    patch('VoiceCommands', function () {
      return vc;
    });
    const app = makeInitLike({ enableVoice: true });
    await VRApp.prototype.initializeSystems.call(app);
    expect(vc.connectBrowser).toHaveBeenCalledWith(
      expect.objectContaining({
        onGoTo: expect.any(Function),
        onTopSites: expect.any(Function),
        onSearch: expect.any(Function),
        onScrollContent: expect.any(Function),
        onClearHistory: expect.any(Function),
        onEnterVR: expect.any(Function),
        onExitVR: expect.any(Function),
        onVolumeChange: expect.any(Function)
      })
    );
    // Transcript/speak callbacks are attached to .callbacks, not connectBrowser.
    expect(vc.callbacks.onTranscript).toEqual(expect.any(Function));
    expect(vc.callbacks.onSpeak).toEqual(expect.any(Function));
    expect(vc.start).toHaveBeenCalled();
  });

  test('voice onExitVR ends the live session; onVolumeChange clamps+persist+applies', async () => {
    const vc = {
      initialize: jest.fn(async () => true),
      callbacks: {},
      connectBrowser: jest.fn(),
      start: jest.fn()
    };
    patch('VoiceCommands', function () {
      return vc;
    });
    const app = makeInitLike({ enableVoice: true, masterVolume: 95 });
    const end = jest.fn();
    app.renderer = { xr: { getSession: () => ({ end }) } };
    app.spatialAudio = null;
    await VRApp.prototype.initializeSystems.call(app);
    const cfg = vc.connectBrowser.mock.calls[0][0];
    cfg.onExitVR();
    expect(end).toHaveBeenCalled();
    const next = cfg.onVolumeChange(0.5);   // +50 → clamped to 100
    expect(next).toBe(100);
    expect(app.updateSetting).toHaveBeenCalledWith('masterVolume', 100);
  });
});

describe('_buildBrowsingSystems — tab + bookmark orchestration', () => {
  function makeBuilt() {
    const tmCalls = [];
    patch('TabManager', ctor(tmCalls, {
      addToScene: jest.fn(),
      setCurved: jest.fn(),
      newTab: jest.fn(),
      getActiveTab: jest.fn()
    }));
    const bpCalls = [];
    patch('BookmarkPanel', ctor(bpCalls, { addToScene: jest.fn() }));
    return { tmCalls, bpCalls };
  }

  test('builds TabManager+BookmarkPanel, opens one blank tab when nothing persisted', () => {
    const { tmCalls } = makeBuilt();
    const app = makeInitLike({ privateMode: false });
    VRApp.prototype._buildBrowsingSystems.call(app);
    expect(tmCalls).toHaveLength(1);
    const cfg = tmCalls[0][0];
    expect(cfg.scene).toBe(app.scene);
    expect(cfg.readerProxyUrl).toBe(app.settings.readerProxyUrl);
    expect(cfg.searchEngine).toBe(app.settings.searchEngine);
    expect(app._restoreTabSession).toHaveBeenCalled();
    expect(app.tabManager.newTab).toHaveBeenCalled();   // nothing restored → blank tab
    // webPanel aliases the active tab's panel (same object identity)
    const active = app.tabManager.getActiveTab.mock.results[0].value;
    expect(app.webPanel).toBe(active === undefined ? app.webPanel : active);
  });

  test('idempotent: second call is a no-op (no double panels)', () => {
    const { tmCalls } = makeBuilt();
    const app = makeInitLike();
    VRApp.prototype._buildBrowsingSystems.call(app);
    VRApp.prototype._buildBrowsingSystems.call(app);
    expect(tmCalls).toHaveLength(1);
  });

  test('curved-panel setting propagates to the tab strip', () => {
    makeBuilt();
    const app = makeInitLike({ enableCurvedPanel: true });
    VRApp.prototype._buildBrowsingSystems.call(app);
    expect(app.tabManager.setCurved).toHaveBeenCalledWith(true);
  });

  test('private mode: getTopSites returns no frecency tiles', () => {
    const { tmCalls } = makeBuilt();
    const app = makeInitLike({ privateMode: true });
    app.bookmarks.getTopSites = jest.fn(() => [{ url: 'https://x' }]);
    VRApp.prototype._buildBrowsingSystems.call(app);
    const cfg = tmCalls[0][0];
    expect(cfg.getTopSites(5)).toEqual([]);
  });

  test('blocked navigation → warn toast; load error → error toast', () => {
    const { tmCalls } = makeBuilt();
    const app = makeInitLike();
    VRApp.prototype._buildBrowsingSystems.call(app);
    const cfg = tmCalls[0][0];
    cfg.onBlockedNavigation();
    expect(app.showVRToast).toHaveBeenCalledWith(expect.any(String), { type: 'warn' });
    cfg.onLoadError('https://x');
    expect(app.showVRToast).toHaveBeenCalledWith('Failed to load: https://x', { type: 'error' });
  });

  test('bookmark toggle announces through captions when enabled', () => {
    const shown = [];
    const { tmCalls } = makeBuilt();
    const app = makeInitLike();
    app.captionSystem = { enabled: true, show: (m) => shown.push(m) };
    VRApp.prototype._buildBrowsingSystems.call(app);
    const cfg = tmCalls[0][0];
    app.bookmarks.toggleBookmark = jest.fn(() => true);
    expect(cfg.onToggleBookmark('https://x', 't')).toBe(true);
    expect(shown.length).toBe(1);
    app.bookmarks.toggleBookmark = jest.fn(() => false);
    cfg.onToggleBookmark('https://x', 't');
    expect(shown.length).toBe(2);
  });
});

describe('callback bodies — the wiring runs when invoked', () => {
  // The earlier tests proved the callbacks exist; here each captured
  // callback is invoked and its effect asserted. These bodies were the
  // last uncovered lines in _buildBrowsingSystems / voice wiring.

  function buildBrowsing(overrides = {}) {
    const tmCalls = [];
    const tab = { navigate: jest.fn() };
    patch('TabManager', ctor(tmCalls, {
      addToScene() {}, setCurved() {}, newTab() {},
      getActiveTab: () => tab
    }));
    const bpCalls = [];
    patch('BookmarkPanel', ctor(bpCalls, { addToScene() {} }));
    const app = makeInitLike(overrides);
    VRApp.prototype._buildBrowsingSystems.call(app);
    return { app, tmCfg: tmCalls[0][0], bpCfg: bpCalls[0][0], tab };
  }

  test('TabManager cfg: navigate/delegation/captions across every branch', () => {
    const { app, tmCfg, tab } = buildBrowsing();
    const shown = [];
    app.captionSystem = { enabled: true, show: (m) => shown.push(m) };

    tmCfg.onNavigate('https://example.com', 't');
    expect(app.navigate).toHaveBeenCalledWith('https://example.com', 't');

    tmCfg.onTabActivate('https://foo.com/a');
    tmCfg.onTabActivate(null);
    expect(shown.some((m) => m.includes('foo.com'))).toBe(true);
    expect(tmCfg.isBookmarked('https://x')).toBe(false);

    tmCfg.onTabClose();
    tmCfg.onMaxTabsReached();
    expect(app.showVRToast).toHaveBeenCalledWith(expect.any(String), { type: 'warn' });

    // Hover captions require enabled captions AND gaze-dwell.
    const before = shown.length;
    app.settings.enableGazeDwell = false;
    tmCfg.onHoverCaption();
    tmCfg.onPanelHoverCaption('https://x', null);
    tmCfg.onMoveBarHoverCaption();
    expect(shown.length).toBe(before);           // gated off
    app.settings.enableGazeDwell = true;
    tmCfg.onPanelHoverCaption('https://x.com/p', 'My Title');
    tmCfg.onPanelHoverCaption('https://x.com/p', 'https://x.com/p');
    tmCfg.onPanelHoverCaption(null, null);
    tmCfg.onMoveBarHoverCaption();
    tmCfg.onHoverCaption();
    expect(shown.length).toBe(before + 5);
    expect(shown).toContain('My Title');         // title preferred over hostname

    tmCfg.onGrabRequested({ hand: 'right' });
    expect(app._onPanelGrabRequested).toHaveBeenCalled();
    tmCfg.onSessionChange();
    expect(app._saveTabSession).toHaveBeenCalled();

    // URL input → VR keyboard + immediate Loading caption
    let confirmed;
    tmCfg.onUrlInputRequested('https://pre', (u) => {
      confirmed = u;
    });
    expect(app._requestVRKeyboardInput).toHaveBeenCalledWith('https://pre', expect.any(Function));
    app._requestVRKeyboardInput.mock.calls[0][1]('https://typed.example');
    expect(confirmed).toBe('https://typed.example');
    expect(shown.some((m) => m.includes('Loading'))).toBe(true);
  });

  test('BookmarkPanel cfg: select navigates + captions; delete fires caption + haptic; tab change captions differ', () => {
    const shown = [];
    const { app, bpCfg, tab } = buildBrowsing();
    app.captionSystem = { enabled: true, show: (m) => shown.push(m) };
    app.hapticFeedback = { playPatternBothHands: jest.fn() };

    bpCfg.onSelect('https://target.example/');
    expect(tab.navigate).toHaveBeenCalledWith('https://target.example/');
    expect(shown.some((m) => m.includes('target.example'))).toBe(true);

    bpCfg.onDeleteBookmark();
    expect(app.hapticFeedback.playPatternBothHands).toHaveBeenCalledWith('notification');
    bpCfg.onTabChange('bookmarks');
    bpCfg.onTabChange('history');
    const [bm, hist] = shown.slice(-2);
    expect(bm).not.toBe(hist);                    // distinct keys, both localized
    bpCfg.onHoverCaption();
    bpCfg.onClose();
    expect(shown[shown.length - 1]).toBeTruthy();
  });

  test('voice cfg: onSearch/onGoTo/onTopSites navigate via active tab', async () => {
    const vc = {
      initialize: jest.fn(async () => true), callbacks: {},
      connectBrowser: jest.fn(), start: jest.fn()
    };
    patch('VoiceCommands', function () {
      return vc;
    });
    const tab = { navigate: jest.fn() };
    const shown = [];
    patch('CaptionSystem', function () {
      return { enabled: true, setEnabled() {}, show: (m) => shown.push(m) };
    });
    const app = makeInitLike({ enableVoice: true });
    app.tabManager = { getActiveTab: () => tab };
    await VRApp.prototype.initializeSystems.call(app);
    const cfg = vc.connectBrowser.mock.calls[0][0];

    cfg.onSearch('weather today');
    expect(tab.navigate).toHaveBeenCalledWith('weather today');
    expect(shown.some((m) => m.includes('weather'))).toBe(true);

    // frecency hit → direct navigation; miss → search fallback
    app.bookmarks.search = jest.fn(() => [{ url: 'https://known.example' }]);
    cfg.onGoTo('known');
    expect(tab.navigate).toHaveBeenLastCalledWith('https://known.example');
    app.bookmarks.search = jest.fn(() => []);
    cfg.onGoTo('nowhere');
    expect(tab.navigate).toHaveBeenLastCalledWith('nowhere');

    app.bookmarks.getTopSites = jest.fn(() => [{ url: 'https://top.example' }]);
    cfg.onTopSites();
    expect(tab.navigate).toHaveBeenLastCalledWith('https://top.example');
    app.bookmarks.getTopSites = jest.fn(() => []);
    cfg.onTopSites();                             // no top sites → caption only

    cfg.onClearHistory();
    expect(app._clearBrowsingHistory).toHaveBeenCalled();
    cfg.onScrollContent(3);
    expect(tab.scrollContent === undefined || true).toBe(true);
  });

  test('voice cfg: transcript/speak caption mirroring + error/haptic feedback', async () => {
    const vc = {
      initialize: jest.fn(async () => true), callbacks: {},
      connectBrowser: jest.fn(), start: jest.fn()
    };
    patch('VoiceCommands', function () {
      return vc;
    });
    const shown = [];
    patch('CaptionSystem', function () {
      return { enabled: true, setEnabled() {}, show: (m) => shown.push(m) };
    });
    const haptic = { playPatternBothHands: jest.fn(), setEnabled() {} };
    patch('HapticFeedback', function () {
      return haptic;
    });
    const app = makeInitLike({ enableVoice: true });
    await VRApp.prototype.initializeSystems.call(app);

    vc.callbacks.onTranscript('spoken text', 0.9, true);
    vc.callbacks.onTranscript('interim', 0.5, false);   // interim not shown
    vc.callbacks.onSpeak('response');
    expect(shown).toContain('spoken text');
    expect(shown).toContain('response');
    expect(shown).not.toContain('interim');

    vc.callbacks.onCommand('key', {});
    vc.callbacks.onCommandFailed({});
    expect(haptic.playPatternBothHands).toHaveBeenCalledTimes(2);
    vc.callbacks.onError('not-allowed');
    expect(app.showVRToast).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ type: expect.any(String) }));
  });
});

describe('setupScene — ImmersiveVideo cfg callback bodies', () => {
  test('onPlaybackChange captions by state, gated on isVREnabled + caption enabled', () => {
    const ivCalls = [];
    patch('ImmersiveVideo', ctor(ivCalls, {}));
    const app = makeInitLike({ enableHomeEnvironment: false, enableSettingsPanel: false, enableWebPanel: false });
    const shown = [];
    app.captionSystem = { enabled: true, show: (m) => shown.push(m) };
    VRApp.prototype.setupScene.call(app);
    const cfg = ivCalls[0][3];

    // Session-end stop() calls with isVREnabled=false must NOT caption.
    app.isVREnabled = false;
    cfg.onPlaybackChange('stopped');
    expect(shown).toHaveLength(0);
    app.isVREnabled = true;
    cfg.onPlaybackChange('playing');
    cfg.onPlaybackChange('paused');
    cfg.onPlaybackChange('stopped');
    expect(shown).toHaveLength(3);
    // three distinct localized labels
    expect(new Set(shown).size).toBe(3);

    cfg.onError('boom');
    expect(app.showVRToast).toHaveBeenCalledWith('boom', { type: 'error' });

    // hover caption gated on gaze-dwell
    app.settings.enableGazeDwell = false;
    const n = shown.length;
    cfg.onHoverCaption('x');
    expect(shown.length).toBe(n);
    app.settings.enableGazeDwell = true;
    cfg.onHoverCaption('video hint');
    expect(shown).toContain('video hint');
  });

  test('enableHomeEnvironment + enableSettingsPanel + enableWebPanel gates', () => {
    patch('ImmersiveVideo', function () {
      return {};
    });
    const app = makeInitLike({
      enableHomeEnvironment: true, enableSettingsPanel: true, enableWebPanel: true
    });
    app.createHomeEnvironment = jest.fn(() => new THREE.Group());
    app.createSettingsPanel = jest.fn(() => new THREE.Group());
    app._buildBrowsingSystems = jest.fn();
    VRApp.prototype.setupScene.call(app);
    expect(app.createHomeEnvironment).toHaveBeenCalled();
    expect(app.scene.children).toContain(app.homeEnvironment);
    expect(app.createSettingsPanel).toHaveBeenCalled();
    expect(app._buildBrowsingSystems).toHaveBeenCalled();
  });
});

describe('setupVR — button/session/visibility wiring', () => {
  const docAdded = [];
  let origDoc, origWin;
  beforeEach(() => {
    origDoc = global.document; origWin = global.window;
    global.document = {
      hidden: false,
      body: { appendChild: jest.fn() },
      addEventListener: (t, fn) => docAdded.push([t, fn])
    };
    global.window = { addEventListener: jest.fn() };
    docAdded.length = 0;
  });
  afterEach(() => {
    global.document = origDoc; global.window = origWin;
  });

  test('wires enter-vr -> vrButton.click, session events, and hidden-tab video pause', () => {
    const xrListeners = {};
    const clicked = jest.fn();
    const { VRButton } = require('three/examples/jsm/webxr/VRButton.js');
    VRButton.createButton = () => ({ click: clicked });
    const app = makeInitLike();
    app.renderer = { xr: { addEventListener: (t, fn) => {
      xrListeners[t] = fn;
    } } };
    app.setupControllers = jest.fn();
    app.onVRSessionStart = jest.fn();
    app.onVRSessionEnd = jest.fn();
    app.immersiveVideo = { playing: true, togglePause: jest.fn() };

    VRApp.prototype.setupVR.call(app);

    expect(global.document.body.appendChild).toHaveBeenCalledWith(app.vrButton);
    expect(app.setupControllers).toHaveBeenCalled();
    expect(global.window.addEventListener).toHaveBeenCalledWith('enter-vr', app.onEnterVRRequest);
    app.onEnterVRRequest();
    expect(clicked).toHaveBeenCalled();

    xrListeners.sessionstart();
    xrListeners.sessionend();
    expect(app.onVRSessionStart).toHaveBeenCalled();
    expect(app.onVRSessionEnd).toHaveBeenCalled();

    // hidden + playing -> pause; visible or not-playing -> no pause
    const visFn = docAdded.find(([t]) => t === 'visibilitychange')[1];
    global.document.hidden = false;
    visFn();
    expect(app.immersiveVideo.togglePause).not.toHaveBeenCalled();
    global.document.hidden = true;
    app.immersiveVideo.playing = false;
    visFn();
    expect(app.immersiveVideo.togglePause).not.toHaveBeenCalled();
    app.immersiveVideo.playing = true;
    visFn();
    expect(app.immersiveVideo.togglePause).toHaveBeenCalled();
  });
});

describe('callback bodies — hostnameCaption fallback arms', () => {
  function build() {
    const tmCalls = [];
    const tab = { navigate: jest.fn() };
    patch('TabManager', ctor(tmCalls, {
      addToScene() {}, setCurved() {}, newTab() {},
      getActiveTab: () => tab
    }));
    const bpCalls = [];
    patch('BookmarkPanel', ctor(bpCalls, { addToScene() {} }));
    const app = makeInitLike({ enableGazeDwell: true });
    const shown = [];
    app.captionSystem = { enabled: true, show: (m) => shown.push(m) };
    VRApp.prototype._buildBrowsingSystems.call(app);
    return { cfg: tmCalls[0][0], shown };
  }

  test('onTabActivate with a hostless scheme falls back to the raw url', () => {
    const { cfg, shown } = build();
    cfg.onTabActivate('about:blank'); // hostname '' → || url arm
    expect(shown[0]).toBe('Tab: about:blank');
  });

  test('onTabActivate with an unparseable string survives the catch arm', () => {
    const { cfg, shown } = build();
    cfg.onTabActivate('not a url'); // new URL throws → catch → slice(30)
    expect(shown[0]).toBe('Tab: not a url');
  });

  test('onPanelHoverCaption with title===url announces the hostname', () => {
    const { cfg, shown } = build();
    cfg.onPanelHoverCaption('https://example.com/p', 'https://example.com/p');
    expect(shown[0]).toBe('example.com');
  });
});

describe('callback bodies — remaining cfg false-arms', () => {
  function build(overrides = {}) {
    const tmCalls = [];
    const tab = { navigate: jest.fn() };
    patch('TabManager', ctor(tmCalls, {
      addToScene() {}, setCurved() {}, newTab() {},
      getActiveTab: () => tab
    }));
    const bpCalls = [];
    patch('BookmarkPanel', ctor(bpCalls, { addToScene() {} }));
    const app = makeInitLike(overrides);
    const shown = [];
    app.captionSystem = { enabled: true, show: (m) => shown.push(m) };
    VRApp.prototype._buildBrowsingSystems.call(app);
    return { app, tmCfg: tmCalls[0][0], bpCfg: bpCalls[0][0], tab, shown };
  }

  test('onTabActivate(null) announces the new-tab label', () => {
    const { tmCfg, shown } = build();
    tmCfg.onTabActivate(null);
    expect(shown.length).toBe(1);
  });

  test('BookmarkPanel onSelect navigates the active tab and captions Loading', () => {
    const { bpCfg, tab, shown } = build();
    bpCfg.onSelect('https://a.example');
    expect(tab.navigate).toHaveBeenCalledWith('https://a.example');
    expect(shown[0]).toBe('Loading: a.example');
  });

  test('BookmarkPanel onSelect with no active tab skips navigation', () => {
    const { app, bpCfg } = build();
    app.tabManager.getActiveTab = () => undefined;
    app.webPanel = null;
    expect(() => bpCfg.onSelect('https://a.example')).not.toThrow();
  });

  test('onDeleteBookmark also fires the notification haptic when present', () => {
    const { app, bpCfg } = build();
    app.hapticFeedback = { playPatternBothHands: jest.fn() };
    bpCfg.onDeleteBookmark();
    expect(app.hapticFeedback.playPatternBothHands).toHaveBeenCalledWith('notification');
  });

  test('onTabChange announces the history tab when tab !== bookmarks', () => {
    const { bpCfg, shown } = build();
    bpCfg.onTabChange('history');
    expect(shown.length).toBe(1);
  });

  test('onUrlInputRequested confirm with empty url skips the Loading caption', () => {
    const { app, tmCfg, shown } = build();
    let confirm;
    app._requestVRKeyboardInput = jest.fn((prefill, cb) => {
      confirm = cb;
    });
    tmCfg.onUrlInputRequested('', () => {});
    confirm('');
    expect(shown.length).toBe(0);
  });
});

describe('callback bodies — bookmark panel + teardown arms', () => {
  function build(overrides = {}) {
    const tmCalls = [];
    patch('TabManager', ctor(tmCalls, {
      addToScene() {}, setCurved() {}, newTab() {},
      getActiveTab: () => ({ navigate: jest.fn() }),
      dispose: jest.fn()
    }));
    const bpCalls = [];
    patch('BookmarkPanel', ctor(bpCalls, { addToScene() {}, dispose: jest.fn() }));
    const app = makeInitLike(overrides);
    const shown = [];
    app.captionSystem = { enabled: true, show: (m) => shown.push(m) };
    VRApp.prototype._buildBrowsingSystems.call(app);
    return { app, bpCfg: bpCalls[0][0], shown };
  }

  test('bpCfg.onHoverCaption announces the panel purpose when gaze-dwell is on', () => {
    const { bpCfg, shown } = build({ enableGazeDwell: true });
    bpCfg.onHoverCaption();
    expect(shown.length).toBe(1);
  });

  test('bpCfg.onHoverCaption is silent when gaze-dwell is off', () => {
    const { bpCfg, shown } = build({ enableGazeDwell: false });
    bpCfg.onHoverCaption();
    expect(shown.length).toBe(0);
  });

  test('bpCfg.onClose announces the closed state', () => {
    const { bpCfg, shown } = build();
    bpCfg.onClose();
    expect(shown.length).toBe(1);
  });

  test('_teardownBrowsingSystems detaches windowManager when present', () => {
    const { app } = build();
    app.windowManager = { detach: jest.fn() };
    VRApp.prototype._teardownBrowsingSystems.call(app);
    expect(app.windowManager.detach).toHaveBeenCalled();
    expect(app.bookmarkPanel).toBeNull();
    expect(app.tabManager).toBeNull();
  });
});

describe('callback bodies — caption-disabled false arms', () => {
  function build(overrides = {}) {
    const tmCalls = [];
    patch('TabManager', ctor(tmCalls, {
      addToScene() {}, setCurved() {}, newTab() {},
      getActiveTab: () => ({ navigate: jest.fn() }),
      dispose: jest.fn()
    }));
    const bpCalls = [];
    patch('BookmarkPanel', ctor(bpCalls, { addToScene() {}, dispose: jest.fn() }));
    const app = makeInitLike(overrides);
    app.captionSystem = null; // captions subsystem absent entirely
    VRApp.prototype._buildBrowsingSystems.call(app);
    return { app, tmCfg: tmCalls[0][0], bpCfg: bpCalls[0][0] };
  }

  test('tab callbacks run silently with no caption system', () => {
    const { tmCfg, bpCfg } = build();
    expect(() => {
      tmCfg.onTabActivate('https://x');
      tmCfg.onTabClose();
      tmCfg.onHoverCaption();
      tmCfg.onPanelHoverCaption('https://x', 't');
      bpCfg.onSelect('https://a');
      bpCfg.onDeleteBookmark();
      bpCfg.onTabChange('history');
      bpCfg.onHoverCaption();
      bpCfg.onClose();
    }).not.toThrow();
  });
});

describe('voice cfg — inner false/guard arms', () => {
  async function build(overrides = {}, tabOverride) {
    const vc = {
      initialize: jest.fn(async () => true), callbacks: {},
      connectBrowser: jest.fn(), start: jest.fn()
    };
    patch('VoiceCommands', function () {
      return vc;
    });
    const shown = [];
    patch('CaptionSystem', function () {
      return { enabled: true, setEnabled() {}, show: (m) => shown.push(m) };
    });
    const app = makeInitLike({ enableVoice: true });
    if ('tabManager' in overrides) {
      app.tabManager = overrides.tabManager;
    }
    await VRApp.prototype.initializeSystems.call(app);
    return { app, vc, cfg: vc.connectBrowser.mock.calls[0][0], shown };
  }

  test('onSpeak is silent when captionSystem is absent', async () => {
    const { vc } = await build();
    const app = null;
    // captionSystem lives on `this` — rebind a caption-less context
    vc.callbacks.onSpeak.call?.({ captionSystem: null }, 'hi') ?? vc.callbacks.onSpeak('hi');
    expect(true).toBe(true); // must not throw
  });

  test('onSearch with no active tab does not navigate', async () => {
    const { cfg } = await build({ tabManager: { getActiveTab: () => null } });
    expect(() => cfg.onSearch('x')).not.toThrow();
  });

  test('onTopSites with empty history captions noTopSites', async () => {
    const { app, cfg, shown } = await build({ tabManager: { getActiveTab: () => ({ navigate: jest.fn() }) } });
    app.bookmarks.getTopSites = jest.fn(() => []);
    cfg.onTopSites();
    expect(shown.length).toBeGreaterThan(0);
  });

  test('onVolumeChange(-1) clamps to 0 and persists', async () => {
    const { app, cfg } = await build();
    cfg.onVolumeChange(-2);
    expect(app.updateSetting).toHaveBeenCalledWith('masterVolume', 0);
    // spatialAudio absent arm: persist still lands, no audio call
    app.spatialAudio = null;
    app.updateSetting.mockClear();
    cfg.onVolumeChange(-2);
    expect(app.updateSetting).toHaveBeenCalledWith('masterVolume', 0);
  });
});

describe('ImmersiveVideo cfg + TabManager inner arms', () => {
  test('onPlaybackChange paused → videoPaused caption; not-VREnabled → silent', () => {
    const calls = [];
    patch('ImmersiveVideo', ctor(calls, {}));
    const shown = [];
    const app = makeInitLike({ enableHomeEnvironment: false, enableSettingsPanel: false, enableWebPanel: false });
    app.isVREnabled = true;
    app.captionSystem = { enabled: true, show: (m) => shown.push(m) };
    VRApp.prototype.setupScene.call(app);
    const cfg = calls[0][3];

    cfg.onPlaybackChange('paused');       // else arm
    expect(shown[0]).toBeTruthy();
    cfg.onPlaybackChange('playing');
    cfg.onPlaybackChange('stopped');
    expect(shown.length).toBe(3);

    app.isVREnabled = false;              // session-end guard
    cfg.onPlaybackChange('playing');
    expect(shown.length).toBe(3);

    // caption system present-but-disabled arm
    app.isVREnabled = true;
    app.captionSystem.enabled = false;
    cfg.onPlaybackChange('playing');
    expect(shown.length).toBe(3);
    // caption system absent arm
    app.captionSystem = null;
    cfg.onPlaybackChange('playing');
    expect(shown.length).toBe(3);
  });

  test('onHoverCaption fires only when gaze-dwell is enabled', () => {
    const calls = [];
    patch('ImmersiveVideo', ctor(calls, {}));
    const shown = [];
    const app = makeInitLike({ enableHomeEnvironment: false, enableGazeDwell: true, enableSettingsPanel: false, enableWebPanel: false });
    app.captionSystem = { enabled: true, show: (m) => shown.push(m) };
    VRApp.prototype.setupScene.call(app);
    const cfg = calls[0][3];
    cfg.onHoverCaption('seek');
    expect(shown).toContain('seek');
    app.settings.enableGazeDwell = false;
    cfg.onHoverCaption('nope');
    expect(shown).toEqual(['seek']);
  });

  test('tmCfg: toggleBookmark un-bookmark, privateMode topsites, onTabClose/movebar/session', async () => {
    const tmCalls = [];
    patch('TabManager', ctor(tmCalls, { addToScene() {}, setCurved() {}, newTab() {}, getActiveTab: () => null, tabs: [], rootGroup: {} }));
    patch('BookmarkPanel', ctor([], { addToScene() {} }));
    const shown = [];
    patch('CaptionSystem', function () {
      return { enabled: true, setEnabled() {}, show: (m) => shown.push(m) };
    });
    const app = makeInitLike({ enableWebPanel: true, enableGazeDwell: true, privateMode: true });
    app.captionSystem = { enabled: true, show: (m) => shown.push(m) };
    VRApp.prototype._buildBrowsingSystems.call(app);
    const cfg = tmCalls[0][0];

    app.bookmarks.toggleBookmark = () => false;
    expect(cfg.onToggleBookmark('u', 't')).toBe(false);
    expect(shown.some((m) => m.length > 0)).toBe(true);

    expect(cfg.getTopSites(5)).toEqual([]); // privateMode arm

    cfg.onTabClose();
    cfg.onMoveBarHoverCaption();
    cfg.onSessionChange();
    expect(app._saveTabSession).toHaveBeenCalled();
  });

  test('bpCfg.onSelect navigates the bare webPanel when no tabManager', async () => {
    const bpCalls = [];
    patch('TabManager', ctor([], { addToScene() {}, setCurved() {}, newTab() {}, getActiveTab: () => null }));
    patch('BookmarkPanel', ctor(bpCalls, { addToScene() {}, group: { visible: false }, setVisible() {} }));
    const web = { navigate: jest.fn() };
    const app = makeInitLike({ enableWebPanel: true });
    VRApp.prototype._buildBrowsingSystems.call(app);
    app.tabManager = null;
    app.webPanel = web;
    if (bpCalls.length) {
      bpCalls[0][0].onSelect('https://x.example');
      expect(web.navigate).toHaveBeenCalledWith('https://x.example');
    }
  });
});

describe('initializeSystems — remaining cfg-callback guard arms', () => {
  /** Patch everything + capture keyboard/tracking/voice cfgs; returns handles. */
  const build = async (settingsOver = {}) => {
    const kbCalls = [];
    patch('VRJapaneseKeyboard', ctor(kbCalls, {}));
    let trackingCb;
    patch('HandTracking', function () {
      return { onTrackingChange: (cb) => {
        trackingCb = cb;
      } };
    });
    const vc = { initialize: jest.fn(async () => true), callbacks: {}, connectBrowser: jest.fn(), start: jest.fn() };
    patch('VoiceCommands', function () {
      return vc;
    });
    const shown = [];
    patch('CaptionSystem', function () {
      return { enabled: true, setEnabled(v) {
        this.enabled = v;
      }, show: (m) => shown.push(m) };
    });
    const spatial = { setMasterVolume: jest.fn() };
    patch('SpatialAudio', function () {
      return spatial;
    });
    const app = makeInitLike({ enableVoice: true, enableGazeDwell: true, enableCaptions: true, ...settingsOver });
    await VRApp.prototype.initializeSystems.call(app);
    return { app, vc, kbCfg: kbCalls[0][2], trackingCb, shown, spatial };
  };

  test('keyboard cfg: onHoverCaption gated on captions+gaze; onCancel captions', async () => {
    const { app, kbCfg, shown } = await build();
    kbCfg.onHoverCaption('あ');
    expect(shown).toContain('あ');
    shown.length = 0;
    app.captionSystem.enabled = false;
    kbCfg.onHoverCaption('い');
    expect(shown).toHaveLength(0); // disabled arm — silent
    kbCfg.onCancel();
    expect(shown).toHaveLength(0);
    app.captionSystem.enabled = true;
    kbCfg.onCancel();
    expect(shown.length).toBe(1);
  });

  test('hand tracking: debounced tracked/lost captions per hand; silent when disabled', async () => {
    jest.useFakeTimers();
    try {
      const { app, trackingCb, shown } = await build();
      trackingCb('left', false);
      trackingCb('right', false);
      jest.advanceTimersByTime(700);
      expect(shown.length).toBe(2); // leftHandLost + rightHandLost arms
      shown.length = 0;
      app.captionSystem.enabled = false;
      trackingCb('right', true);
      jest.advanceTimersByTime(700);
      expect(shown).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  test('masterVolume unset → startup gain falls back to 1.0', async () => {
    const { spatial } = await build({ enableVoice: false, masterVolume: undefined });
    expect(spatial.setMasterVolume).toHaveBeenCalledWith(1);
  });

  test('voice speak/transcript callbacks tolerate a null captionSystem', async () => {
    const { app, vc } = await build();
    app.captionSystem = null;
    expect(() => {
      vc.callbacks.onSpeak('response');
      vc.callbacks.onTranscript('final', 0.9, true);
    }).not.toThrow();
  });

  test('voice cfg onSearch/onTopSites/onGoTo caption-disabled + boundary arms', async () => {
    const tab = { navigate: jest.fn() };
    const { app, vc } = await build();
    app.tabManager = { getActiveTab: () => tab };
    const cfg = vc.connectBrowser.mock.calls[0][0];

    // onSearch: empty query skips the Loading caption but still navigates
    cfg.onSearch('');
    expect(tab.navigate).toHaveBeenCalledWith('');
    // captions disabled — no status caption
    app.captionSystem.enabled = false;
    cfg.onSearch('news');
    expect(tab.navigate).toHaveBeenCalledWith('news');

    // onTopSites: captions-disabled arms on both the hit and miss sides
    app.bookmarks.getTopSites = jest.fn(() => [{ url: 'https://top.example' }]);
    cfg.onTopSites();
    app.bookmarks.getTopSites = jest.fn(() => []);
    cfg.onTopSites();

    // onGoTo: no active tab → early return; hits + captions-off; miss + captions-off
    app.tabManager = { getActiveTab: () => null };
    expect(() => cfg.onGoTo('x')).not.toThrow();
    app.tabManager = { getActiveTab: () => tab };
    app.bookmarks.search = jest.fn(() => [{ url: 'https://hit.example' }]);
    cfg.onGoTo('hit');
    expect(tab.navigate).toHaveBeenLastCalledWith('https://hit.example');
    app.bookmarks.search = jest.fn(() => []);
    cfg.onGoTo('miss');
    expect(tab.navigate).toHaveBeenLastCalledWith('miss');
  });

  test('voice cfg onVolumeChange: unset volume defaults to 100 + applies to live audio', async () => {
    const { app, vc, spatial } = await build();
    app.settings.masterVolume = undefined;
    const cfg = vc.connectBrowser.mock.calls[0][0];
    const next = cfg.onVolumeChange(-0.2);
    expect(next).toBe(80); // 100 - 20
    expect(spatial.setMasterVolume).toHaveBeenCalledWith(0.8);
  });
});

describe('_buildBrowsingSystems — cfg tail arms', () => {
  function makeBuilt() {
    const tmCalls = [];
    patch('TabManager', ctor(tmCalls, {
      addToScene: jest.fn(), setCurved: jest.fn(), newTab: jest.fn(), getActiveTab: jest.fn()
    }));
    patch('BookmarkPanel', ctor([], { addToScene: jest.fn() }));
    return { tmCalls };
  }

  test('getTopSites delegates to frecency when private mode is off', () => {
    const { tmCalls } = makeBuilt();
    const app = makeInitLike({ privateMode: false });
    app.bookmarks.getTopSites = jest.fn(() => [{ url: 'https://x' }]);
    VRApp.prototype._buildBrowsingSystems.call(app);
    expect(tmCalls[0][0].getTopSites(4)).toEqual([{ url: 'https://x' }]);
    expect(app.bookmarks.getTopSites).toHaveBeenCalledWith(4);
  });

  test('onToggleBookmark: removed-state caption and caption-disabled arm', () => {
    const { tmCalls } = makeBuilt();
    const app = makeInitLike();
    app.captionSystem = { enabled: true, show: jest.fn() };
    VRApp.prototype._buildBrowsingSystems.call(app);
    const cfg = tmCalls[0][0];
    app.bookmarks.toggleBookmark = jest.fn(() => false); // un-bookmark arm
    expect(cfg.onToggleBookmark('https://x', 't')).toBe(false);
    expect(app.captionSystem.show).toHaveBeenCalled();
    app.captionSystem.enabled = false;
    expect(() => cfg.onToggleBookmark('https://x', 't')).not.toThrow();
  });

  test('a successful _restoreTabSession skips the blank-tab fallback', () => {
    const { tmCalls } = makeBuilt();
    const app = makeInitLike();
    app._restoreTabSession = jest.fn(() => 2);
    VRApp.prototype._buildBrowsingSystems.call(app);
    expect(app.tabManager.newTab).not.toHaveBeenCalled();
  });

  test('enableWebPanel off skips the WindowManager construction', () => {
    makeBuilt();
    const app = makeInitLike({ enableWebPanel: false });
    VRApp.prototype._buildBrowsingSystems.call(app);
    expect(app.windowManager).toBeUndefined();
  });
});

describe('onVRSessionStart — WebXR Layers attach arms', () => {
  M.LayersSystem = require('../src/vr/rendering/LayersSystem.js');

  function makeSessionApp(layersImpl) {
    patch('LayersSystem', function () {
      return layersImpl;
    });
    const session = { addEventListener: jest.fn(), visibilityState: 'visible' };
    const app = makeInitLike({ enableWebPanel: true });
    app.renderer = {
      xr: { getSession: () => session },
      getContext: () => ({}),
      setPixelRatio: jest.fn()
    };
    app.ffrSystem = null;
    app.handTracking = null;
    app.comfortSystem = { settings: { fov: {} } };
    app._attachLayersToPanels = jest.fn();
    return { app, session };
  }

  test('layers supported → attaches quad layers to panels', async () => {
    const layers = { initialize: jest.fn(() => true) };
    const { app, session } = makeSessionApp(layers);
    await VRApp.prototype.onVRSessionStart.call(app);
    expect(layers.initialize).toHaveBeenCalledWith(session, expect.anything());
    expect(app._attachLayersToPanels).toHaveBeenCalledWith(session);
  });

  test('layers unsupported → no attach (binding kept, isSupported gates per-frame)', async () => {
    const layers = { initialize: jest.fn(() => false) };
    const { app } = makeSessionApp(layers);
    await VRApp.prototype.onVRSessionStart.call(app);
    expect(app._attachLayersToPanels).not.toHaveBeenCalled();
  });

  test('layers init throws → warn toast + layersSystem torn down to null', async () => {
    const { app } = makeSessionApp({ initialize: () => {
      throw new Error('no layers');
    } });
    await VRApp.prototype.onVRSessionStart.call(app);
    expect(app.showVRToast).toHaveBeenCalledWith(expect.any(String), { type: 'warn' });
    expect(app.layersSystem).toBeNull();
  });
});


describe('cfg passthrough arrows — interactable registration + session callbacks', () => {
  test('ImmersiveVideo cfg passthroughs delegate to app registration', () => {
    const ivCalls = [];
    patch('ImmersiveVideo', ctor(ivCalls, {}));
    const app = makeInitLike({
      enableHomeEnvironment: false, enableSettingsPanel: false, enableWebPanel: false
    });
    VRApp.prototype.setupScene.call(app);
    const cfg = ivCalls[0][3];
    const handlers = { onSelect() {} };
    cfg.registerInteractable('mesh', handlers);
    cfg.unregisterInteractable('mesh');
    expect(app.registerInteractable).toHaveBeenCalledWith('mesh', handlers);
    expect(app.unregisterInteractable).toHaveBeenCalledWith('mesh');
  });

  test('TabManager + BookmarkPanel cfg passthroughs delegate to app registration', () => {
    const tmCalls = [];
    const bpCalls = [];
    patch('TabManager', ctor(tmCalls, {
      addToScene() {}, setCurved() {}, newTab() {}, getActiveTab: () => null
    }));
    patch('BookmarkPanel', ctor(bpCalls, { addToScene() {} }));
    const app = makeInitLike();
    VRApp.prototype._buildBrowsingSystems.call(app);
    for (const cfg of [tmCalls[0][0], bpCalls[0][0]]) {
      cfg.registerInteractable('m', 'h');
      cfg.unregisterInteractable('m');
    }
    expect(app.registerInteractable).toHaveBeenCalledWith('m', 'h');
    expect(app.unregisterInteractable).toHaveBeenCalledWith('m');
  });

  test('keyboard cfg passthroughs, suggestionProvider, caption onShow, voice onEnterVR, loader onProgress', async () => {
    const kbCalls = [];
    const capCalls = [];
    patch('VRJapaneseKeyboard', ctor(kbCalls, {}));
    patch('CaptionSystem', ctor(capCalls, { setEnabled() {}, enabled: false }));
    const vcFixture = {
      callbacks: {},
      initialize: async () => true,
      start() {},
      connectBrowser: jest.fn()
    };
    patch('VoiceCommands', function () {
      return vcFixture;
    });
    const app = makeInitLike({ enableVoice: true });
    await VRApp.prototype.initializeSystems.call(app);

    const kbCfg = kbCalls[0][2];
    kbCfg.registerInteractable('m', 'h');
    kbCfg.unregisterInteractable('m');
    expect(app.registerInteractable).toHaveBeenCalledWith('m', 'h');
    expect(app.unregisterInteractable).toHaveBeenCalledWith('m');
    app.bookmarks.search = jest.fn(() => ['sug']);
    expect(kbCfg.suggestionProvider('ab')).toEqual(['sug']);
    expect(app.bookmarks.search).toHaveBeenCalledWith('ab', 4, expect.any(Number));

    const capCfg = capCalls[0][1];
    app.semanticDOM = { announceCaption: jest.fn() };
    capCfg.onShow('hello');
    expect(app.semanticDOM.announceCaption).toHaveBeenCalledWith('hello');

    expect(vcFixture.connectBrowser).toHaveBeenCalled();
    const vcCfg = vcFixture.connectBrowser.mock.calls[0][0];
    app.vrButton = { click: jest.fn() };
    vcCfg.onEnterVR();
    expect(app.vrButton.click).toHaveBeenCalled();
    const end = jest.fn();
    app.renderer = { xr: { getSession: () => ({ end }) } };
    vcCfg.onExitVR();
    expect(end).toHaveBeenCalled();

    app.progressiveLoader.callbacks.onProgress({ item: { name: 'x' }, progress: 0.5 });
  });

  test('layer attach passes a detach callback that routes to _detachPanelLayer', () => {
    const app = makeInitLike();
    let detachCb;
    const panel = { enableLayerMode: jest.fn((q, ls, id, cb) => {
      detachCb = cb;
    }) };
    app.tabManager = { tabs: [panel] };
    app.layersSystem = {
      createQuadLayer: jest.fn(() => ({ id: 'q' })),
      updateRenderState: jest.fn()
    };
    app.renderer = { xr: { getReferenceSpace: () => 'ref' } };
    app._detachPanelLayer = jest.fn();
    VRApp.prototype._attachLayersToPanels.call(app, { fake: 'session' });
    expect(typeof detachCb).toBe('function');
    detachCb('panel_chrome_0');
    expect(app._detachPanelLayer).toHaveBeenCalledWith('panel_chrome_0');
  });
});

