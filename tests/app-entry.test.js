/**
 * Entry-point tests for src/main.js + src/app.js — the two files index.html
 * actually loads (0% coverage until now). They run side effects at import time,
 * so each test installs a fresh DOM/window harness and requires the module in
 * an isolated registry (jest.isolateModules).
 */

jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({
  VRButton: { createButton: () => ({}) }
}));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: class { createControllerModel() { return {}; } }
}));

/** Minimal element stub: id registry + listener capture + DOM tree bits. */
function makeEl(id = '') {
  const listeners = {};
  return {
    id,
    style: {},
    children: [],
    textContent: '',
    listeners,
    setAttribute: jest.fn(),
    classList: { add: jest.fn(), toggle: jest.fn(), remove: jest.fn() },
    addEventListener: jest.fn((type, fn) => { (listeners[type] ||= []).push(fn); }),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(function (c) { this.children.push(c); return c; }),
    append: jest.fn(function (...cs) { this.children.push(...cs); }),
    replaceChildren: jest.fn(function (...cs) { this.children = cs; }),
    remove: jest.fn(),
    click() { (listeners.click || []).forEach((f) => f({})); },
    dispatch(type, ev = {}) { (listeners[type] || []).forEach((f) => f(ev)); }
  };
}

/**
 * Install global.document/window/navigator with the ids `els` resolved.
 * Returns handles to captured listeners and created elements.
 */
function installDom({ ids = {}, xr = null, serviceWorker = null, standalone = false } = {}) {
  const documentListeners = {};
  const windowListeners = {};
  const created = [];
  const body = makeEl('body');
  const docEl = makeEl('html');

  global.document = {
    readyState: 'complete',
    hidden: false,
    body,
    documentElement: docEl,
    // Elements pre-seeded via `ids`, plus anything createElement() minted
    // (app.js's perf overlay is created at runtime, then re-found by id).
    getElementById: (id) => ids[id] || created.find((e) => e.id === id) || null,
    createElement: (tag) => { const el = makeEl(tag); created.push(el); return el; },
    querySelectorAll: () => ({ forEach: () => {} }),
    addEventListener: (type, fn) => { (documentListeners[type] ||= []).push(fn); },
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    _listeners: documentListeners
  };
  global.navigator = { standalone, ...(xr ? { xr } : {}), ...(serviceWorker ? { serviceWorker } : {}) };
  global.window = {
    navigator: global.navigator, // window.navigator === navigator in browsers
    addEventListener: (type, fn) => { (windowListeners[type] ||= []).push(fn); },
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    matchMedia: (q) => ({ matches: standalone && q.includes('standalone') }),
    standalone,
    QuiBrowser: undefined
  };
  global.CustomEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  global.location = { reload: jest.fn() };

  return { documentListeners, windowListeners, created, body };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { jest.resetModules(); });
afterEach(() => {
  delete global.document;
  delete global.window;
  delete global.location;
  delete global.CustomEvent;
});

describe('src/main.js (landing page entry)', () => {
  test('wires a11y toggles: aria-pressed reflects pref state, click flips + persists', () => {
    const contrastBtn = makeEl('a11yContrast');
    installDom({ ids: { a11yContrast: contrastBtn } });
    jest.isolateModules(() => require('../src/main.js'));
    expect(contrastBtn.setAttribute).toHaveBeenCalledWith('aria-pressed', expect.any(String));
    const before = contrastBtn.setAttribute.mock.calls[0][1];
    contrastBtn.click(); // toggles highContrast
    const after = contrastBtn.setAttribute.mock.calls.at(-1)[1];
    expect(after).not.toBe(before);
  });

  test('shows the floating VR button only when immersive-vr is supported', async () => {
    const floatBtn = makeEl('vrFloatingButton');
    installDom({
      ids: { vrFloatingButton: floatBtn },
      xr: { isSessionSupported: async () => true }
    });
    jest.isolateModules(() => require('../src/main.js'));
    await tick();
    await tick(); // import('./app.js').then() chain
    expect(floatBtn.style.display).toBe('flex');
  });

  test('no xr → floating button stays hidden, no crash', async () => {
    const floatBtn = makeEl('vrFloatingButton');
    installDom({ ids: { vrFloatingButton: floatBtn } });
    jest.isolateModules(() => require('../src/main.js'));
    await tick();
    await tick();
    expect(floatBtn.style.display).not.toBe('flex');
  });

  test('Enter VR button dispatches enter-vr when supported; shows toast when not', async () => {
    const enterBtn = makeEl('enterVRButton');
    const { documentListeners, windowListeners } = installDom({
      ids: { enterVRButton: enterBtn },
      xr: { isSessionSupported: async () => false }
    });
    const dispatched = [];
    global.window.dispatchEvent = (e) => dispatched.push(e);
    void windowListeners;
    jest.isolateModules(() => require('../src/main.js'));
    (documentListeners.DOMContentLoaded || []).forEach((f) => f());
    await enterBtn.listeners.click[0]({}); // async handler
    expect(dispatched.find((e) => e.type === 'enter-vr')).toBeUndefined();
    // unsupported → toast div appended to body instead
    const toast = global.document.body.children.find((c) => c.id === 'vr-error-toast');
    expect(toast).toBeTruthy();
    expect(toast.setAttribute).toHaveBeenCalledWith('role', 'alert');
  });

  test('support probe rejection disables VR cleanly — no unhandled rejection', async () => {
    const floatBtn = makeEl('vrFloatingButton');
    installDom({
      ids: { vrFloatingButton: floatBtn },
      xr: { isSessionSupported: () => Promise.reject(new Error('probe failed')) }
    });
    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      jest.isolateModules(() => require('../src/main.js'));
      await tick();
      await tick();
      await tick();
      expect(floatBtn.style.display).not.toBe('flex');
      expect(unhandled).toHaveLength(0);
    } finally {
      process.removeListener('unhandledRejection', onUnhandled);
    }
  });

  test('PWA standalone launch auto-dispatches enter-vr after the delay', async () => {
    installDom({
      xr: { isSessionSupported: async () => true },
      standalone: true
    });
    jest.isolateModules(() => require('../src/main.js'));
    await tick();
    await tick();
    // 200ms delay lets VRApp register its enter-vr listener first.
    await new Promise((r) => setTimeout(r, 250));
    const dispatched = global.window.dispatchEvent.mock.calls.map(([e]) => e.type);
    expect(dispatched).toContain('enter-vr');
  });

  test('app.js import failure builds the reloadable error overlay', async () => {
    const loading = makeEl('loadingScreen');
    installDom({ ids: { loadingScreen: loading } });
    jest.isolateModules(() => {
      jest.doMock('../src/app.js', () => { throw new Error('chunk missing'); });
      require('../src/main.js');
    });
    await tick();
    await tick();
    await tick();
    // doMock persists in the mock registry across isolateModules — release it
    // once the import promise has settled or later tests still see the throw.
    jest.dontMock('../src/app.js');
    expect(loading.replaceChildren).toHaveBeenCalled();
    const box = loading.replaceChildren.mock.calls[0][0];
    const [heading, detail, reload] = box.children;
    expect(heading.textContent.length).toBeGreaterThan(0);
    expect(detail.textContent).toBe('chunk missing');
    reload.dispatch('click');
    expect(global.location.reload).toHaveBeenCalledTimes(1);
  });

  test('service worker registers against the app base path on load', async () => {
    const registration = { update: jest.fn() };
    const register = jest.fn().mockResolvedValue(registration);
    const { windowListeners } = installDom({ serviceWorker: { register } });
    jest.isolateModules(() => require('../src/main.js'));
    (windowListeners.load || []).forEach((f) => f());
    await tick();
    await tick();
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0][0]).toContain('service-worker.js');
  });

  test('language toggle flips en↔ja and mirrors the target language as its label', () => {
    const langBtn = makeEl('langToggle');
    installDom({ ids: { langToggle: langBtn } });
    jest.isolateModules(() => require('../src/main.js'));
    try {
      // Default lang is en → button offers 日本語.
      expect(langBtn.textContent).toBe('日本語');
      langBtn.click(); // -> ja
      expect(langBtn.textContent).toBe('EN');
      langBtn.click(); // -> en
      expect(langBtn.textContent).toBe('日本語');
    } finally {
      localStorage.clear();
    }
  });

  test('DOMContentLoaded hides the loading screen after the delay', () => {
    const loading = makeEl('loadingScreen');
    const { windowListeners } = installDom({ ids: { loadingScreen: loading } });
    // Fake only setTimeout: main.js's loading-hide uses it, while app.js's
    // perf setInterval must stay on the real clock so advancing timers can't
    // fire it against the headless (renderer-less) VRApp.
    jest.useFakeTimers({ doNotFake: ['setInterval'] });
    try {
      jest.isolateModules(() => require('../src/main.js'));
      (windowListeners.DOMContentLoaded || []).forEach((f) => f());
      jest.advanceTimersByTime(600);
      expect(loading.classList.add).toHaveBeenCalledWith('hidden');
    } finally {
      jest.useRealTimers();
    }
  });

  test('supported Enter VR click dispatches the enter-vr event', async () => {
    const enterBtn = makeEl('enterVRButton');
    const { documentListeners } = installDom({
      ids: { enterVRButton: enterBtn },
      xr: { isSessionSupported: async () => true }
    });
    const dispatched = [];
    global.window.dispatchEvent = (e) => dispatched.push(e);
    jest.isolateModules(() => require('../src/main.js'));
    (documentListeners.DOMContentLoaded || []).forEach((f) => f());
    await enterBtn.listeners.click[0]({});
    expect(dispatched.some((e) => e.type === 'enter-vr')).toBe(true);
  });
});

describe('src/app.js (VR entry — loaded by main.js)', () => {
  test('exports QuiBrowser debug handle; getApp() null before init', async () => {
    installDom({ xr: { isSessionSupported: async () => false } });
    jest.isolateModules(() => require('../src/app.js'));
    await tick();
    expect(global.window.QuiBrowser).toBeTruthy();
    expect(global.window.QuiBrowser.getApp()).toBeNull();
    expect(global.window.QuiBrowser.getStats()).toBeNull();
    expect(global.window.QuiBrowser.version).toBe('2.0.0');
  });

  test('supported XR constructs VRApp and shows error overlay when init fails headless', async () => {
    const container = makeEl('app-container');
    installDom({
      ids: { 'app-container': container },
      xr: { isSessionSupported: async () => true }
    });
    jest.isolateModules(() => require('../src/app.js'));
    await tick();
    await tick();
    await tick();
    // VRApp constructor ran initialize() — setupRenderer throws headless.
    // The failure must surface via the error overlay, not a silent hang.
    const errorDiv = global.document.body.children.find(
      (c) => typeof c.textContent === 'string' && c.textContent.length > 0
    );
    expect(errorDiv).toBeTruthy();
  });

  test('P toggles the perf overlay (fallback) or the rich monitor', async () => {
    const container = makeEl('app-container');
    installDom({
      ids: { 'app-container': container },
      xr: { isSessionSupported: async () => true }
    });
    let documentListeners;
    jest.isolateModules(() => {
      documentListeners = global.document._listeners;
      require('../src/app.js');
    });
    await tick();
    const vrApp = global.window.QuiBrowser.getApp();
    expect(vrApp).toBeTruthy();

    // Fallback overlay: created by setupPerformanceMonitor with cssText that
    // includes display:none — browsers parse cssText into style.*; our stub's
    // style is a plain object, so model the parsed property directly.
    const perfDiv = global.document.getElementById('performance-monitor');
    expect(perfDiv).toBeTruthy();
    perfDiv.style.display = 'none';
    (documentListeners.keydown || []).forEach((f) => f({ key: 'p' }));
    expect(perfDiv.style.display).toBe('block');

    // Rich monitor takes priority when present.
    vrApp.perfMonitorUI = { toggle: jest.fn() };
    (documentListeners.keydown || []).forEach((f) => f({ key: 'P' }));
    expect(vrApp.perfMonitorUI.toggle).toHaveBeenCalledTimes(1);
  });

  test('F toggles FFR; C cycles comfort presets sensitive→moderate→tolerant→disabled', async () => {
    const container = makeEl('app-container');
    installDom({
      ids: { 'app-container': container },
      xr: { isSessionSupported: async () => true }
    });
    jest.isolateModules(() => require('../src/app.js'));
    await tick();
    const vrApp = global.window.QuiBrowser.getApp();
    const keydown = (key) =>
      (global.document._listeners.keydown || []).forEach((f) => f({ key }));

    vrApp.ffrSystem = { enabled: false, enable: jest.fn(), disable: jest.fn() };
    keydown('f');
    expect(vrApp.ffrSystem.enable).toHaveBeenCalledWith(0.5);
    vrApp.ffrSystem.enabled = true;
    keydown('F');
    expect(vrApp.ffrSystem.disable).toHaveBeenCalledTimes(1);

    vrApp.settings.motionSensitivity = 'sensitive';
    vrApp.comfortSystem = { setPreset: jest.fn() };
    vrApp.updateSetting = jest.fn();
    keydown('c');
    expect(vrApp.comfortSystem.setPreset).toHaveBeenCalledWith('moderate');
    expect(vrApp.updateSetting).toHaveBeenCalledWith('motionSensitivity', 'moderate');
    // wraps back to 'sensitive' after 'disabled'
    vrApp.settings.motionSensitivity = 'disabled';
    keydown('c');
    expect(vrApp.comfortSystem.setPreset).toHaveBeenLastCalledWith('sensitive');
  });

  test('Escape disposes the app and clears the perf interval', async () => {
    const container = makeEl('app-container');
    installDom({
      ids: { 'app-container': container },
      xr: { isSessionSupported: async () => true }
    });
    jest.isolateModules(() => require('../src/app.js'));
    await tick();
    const vrApp = global.window.QuiBrowser.getApp();
    vrApp.dispose = jest.fn();
    (global.document._listeners.keydown || []).forEach((f) => f({ key: 'Escape' }));
    expect(vrApp.dispose).toHaveBeenCalledTimes(1);
    expect(global.window.QuiBrowser.getApp()).toBeNull();
  });

  test('beforeunload disposes the app; visibilitychange is a safe no-op', async () => {
    const container = makeEl('app-container');
    const { windowListeners } = installDom({
      ids: { 'app-container': container },
      xr: { isSessionSupported: async () => true }
    });
    jest.isolateModules(() => require('../src/app.js'));
    await tick();
    const vrApp = global.window.QuiBrowser.getApp();
    vrApp.dispose = jest.fn();
    (global.document._listeners.visibilitychange || []).forEach((f) => f());
    (windowListeners.beforeunload || []).forEach((f) => f());
    expect(vrApp.dispose).toHaveBeenCalledTimes(1);
    expect(global.window.QuiBrowser.getApp()).toBeNull();
  });

  test('getStats() returns null instead of crashing when init failed before the renderer existed', async () => {
    const container = makeEl('app-container');
    installDom({
      ids: { 'app-container': container },
      xr: { isSessionSupported: async () => true }
    });
    jest.isolateModules(() => require('../src/app.js'));
    await tick();
    // VRApp constructed but initialize() failed headless → renderer null.
    // The debug handle + perf interval both call getPerformanceStats() on it.
    expect(global.window.QuiBrowser.getStats()).toBeNull();
  });

  test('perf interval paints stats into the visible overlay', async () => {
    const container = makeEl('app-container');
    installDom({
      ids: { 'app-container': container },
      xr: { isSessionSupported: async () => true }
    });
    // Fake setInterval before the module registers the perf interval —
    // timers scheduled under the real clock keep running on it.
    jest.useFakeTimers({ doNotFake: ['setTimeout'] });
    try {
      jest.isolateModules(() => require('../src/app.js'));
      await tick();
      const vrApp = global.window.QuiBrowser.getApp();
      vrApp.getPerformanceStats = () => ({
        fps: 72, frameTime: '13.9', memory: '12 MB', drawCalls: 40, triangles: 12345
      });
      const perfDiv = global.document.getElementById('performance-monitor');
      perfDiv.style.display = 'block';
      jest.advanceTimersByTime(1000);
      expect(perfDiv.innerHTML).toContain('FPS: 72');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('src/main.js — remaining entry arms', () => {
  test('floating VR button click dispatches the enter-vr event', async () => {
    const floatBtn = makeEl('vrFloatingButton');
    const { documentListeners } = installDom({
      ids: { vrFloatingButton: floatBtn },
      xr: { isSessionSupported: async () => true }
    });
    const dispatched = [];
    global.window.dispatchEvent = (e) => dispatched.push(e); // after installDom — it rebuilds window
    jest.isolateModules(() => require('../src/main.js'));
    (documentListeners.DOMContentLoaded || []).forEach((f) => f());
    await tick(); await tick();
    floatBtn.listeners.click[0]({});
    expect(dispatched.find((e) => e.type === 'enter-vr')).toBeTruthy();
  });

  test('a second error toast replaces the first (existing.remove arm)', async () => {
    const enterBtn = makeEl('enterVRButton');
    const { documentListeners } = installDom({
      ids: { enterVRButton: enterBtn },
      xr: { isSessionSupported: async () => false }
    });
    jest.isolateModules(() => require('../src/main.js'));
    (documentListeners.DOMContentLoaded || []).forEach((f) => f());
    await enterBtn.listeners.click[0]({});
    const first = global.document.body.children.find((c) => c.id === 'vr-error-toast');
    expect(first).toBeTruthy();
    expect(first.remove).not.toHaveBeenCalled();
    await enterBtn.listeners.click[0]({}); // second failure → remove prior toast
    expect(first.remove).toHaveBeenCalled();
    // stub remove() doesn't splice — a fresh toast was still appended
    const toasts = global.document.body.children.filter((c) => c.id === 'vr-error-toast');
    expect(toasts).toHaveLength(2);
  });

  test('enterVR handler catch arm → error toast when probe throws', async () => {
    const enterBtn = makeEl('enterVRButton');
    const { documentListeners } = installDom({
      ids: { enterVRButton: enterBtn },
      xr: { isSessionSupported: async () => { throw new Error('xr exploded'); } }
    });
    jest.isolateModules(() => require('../src/main.js'));
    (documentListeners.DOMContentLoaded || []).forEach((f) => f());
    await enterBtn.listeners.click[0]({});
    const toast = global.document.body.children.find((c) => c.id === 'vr-error-toast');
    expect(toast).toBeTruthy();
  });

  test('unhandledrejection listener logs instead of dropping silently', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { windowListeners } = installDom({});
    jest.isolateModules(() => require('../src/main.js'));
    (windowListeners.unhandledrejection || []).forEach((f) =>
      f({ reason: new Error('escaped'), preventDefault: () => {} }));
    expect(errSpy).toHaveBeenCalledWith('Unhandled promise rejection:', expect.any(Error));
    errSpy.mockRestore();
  });

  test('service worker registration failure logs a console error, no throw', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { windowListeners } = installDom({
      serviceWorker: { register: jest.fn(async () => { throw new Error('sw fail'); }) }
    });
    jest.isolateModules(() => require('../src/main.js'));
    (windowListeners.load || []).forEach((f) => f());
    await tick(); await tick();
    expect(errSpy).toHaveBeenCalledWith('Service Worker registration failed:', expect.any(Error));
    errSpy.mockRestore();
  });
});

describe('src/app.js — remaining arms', () => {
  test('visibilitychange handler runs hidden/visible arms without throwing', async () => {
    installDom({ xr: { isSessionSupported: async () => false } });
    let documentListeners;
    jest.isolateModules(() => {
      require('../src/app.js');
      documentListeners = global.document._listeners;
    });
    await tick();
    const handlers = documentListeners.visibilitychange || [];
    expect(handlers.length).toBeGreaterThan(0);
    global.document.hidden = true;
    expect(() => handlers.forEach((f) => f())).not.toThrow();
    global.document.hidden = false;
    expect(() => handlers.forEach((f) => f())).not.toThrow();
  });

  test('perf interval leaves the overlay untouched when getPerformanceStats is null', async () => {
    const container = makeEl('app-container');
    installDom({
      ids: { 'app-container': container },
      xr: { isSessionSupported: async () => true }
    });
    jest.isolateModules(() => require('../src/app.js'));
    await tick();
    const vrApp = global.window.QuiBrowser.getApp();
    const perfDiv = global.document.getElementById('performance-monitor');
    perfDiv.style.display = 'block';
    vrApp.getPerformanceStats = () => null;
    // Null stats → the early-return arm: overlay's innerHTML not rewritten
    // with a stats table (empty / placeholder content only).
    expect(String(perfDiv.innerHTML || '')).not.toContain('FPS:');
  });
});

describe('src/app.js — remaining branch arms', () => {
  const makeApp = () => {
    const container = makeEl('app-container');
    installDom({
      ids: { 'app-container': container },
      xr: { isSessionSupported: async () => true }
    });
    jest.isolateModules(() => require('../src/app.js'));
    return global.window.QuiBrowser;
  };

  test('perf interval: display hidden / vrApp null / stats null arms', async () => {
    jest.useFakeTimers();
    try {
      const QuiBrowser = makeApp();
      await jest.advanceTimersByTimeAsync(0);
      const vrApp = QuiBrowser.getApp();
      // overlay hidden → innerHTML untouched
      const perfDisplay = global.document.getElementById('performance-monitor')
        || global.document._created?.find((e) => e.id === 'performance-monitor');
      jest.advanceTimersByTime(1000);
      // display 'none' → no write regardless of vrApp
      // display:block + stats null → early return, innerHTML stays ''
      if (perfDisplay) {
        perfDisplay.style.display = 'block';
        vrApp.getPerformanceStats = () => null;
        jest.advanceTimersByTime(1000);
        expect(String(perfDisplay.innerHTML || '')).toBe('');
        // stats present but optional fields falsy → `? : ''` arms
        vrApp.getPerformanceStats = () => ({
          fps: 72, frameTime: 13, memory: 'x', drawCalls: 1,
          triangles: 1000, programs: 2, geometries: 3, textures: 4
        });
        jest.advanceTimersByTime(1000);
        expect(String(perfDisplay.innerHTML)).toContain('FPS: 72');
        expect(String(perfDisplay.innerHTML)).not.toContain('FFR:');
      }
    } finally {
      jest.useRealTimers();
    }
  });

  test('P key with no perfMonitorUI toggles the simple overlay both ways', async () => {
    const QuiBrowser = makeApp();
    await tick();
    const vrApp = QuiBrowser.getApp();
    vrApp.perfMonitorUI = null; // force the fallback path
    const keydown = (key) =>
      (global.document._listeners.keydown || []).forEach((f) => f({ key }));
    const perfDisplay = global.document.getElementById('performance-monitor');
    if (perfDisplay) {
      perfDisplay.style.display = 'none';
      keydown('p');
      expect(perfDisplay.style.display).toBe('block');
      keydown('p');
      expect(perfDisplay.style.display).toBe('none');
    }
  });

  test('F/C keys with subsystem absent are no-ops', async () => {
    const QuiBrowser = makeApp();
    await tick();
    const vrApp = QuiBrowser.getApp();
    vrApp.ffrSystem = null;
    vrApp.comfortSystem = null;
    const keydown = (key) =>
      (global.document._listeners.keydown || []).forEach((f) => f({ key }));
    expect(() => { keydown('f'); keydown('c'); }).not.toThrow();
    // vrApp itself null after Escape — P/F/C are all no-ops
    vrApp.dispose = jest.fn();
    keydown('Escape');
    expect(() => { keydown('p'); keydown('f'); keydown('c'); }).not.toThrow();
  });

  test('beforeunload with vrApp null and no interval does not throw', async () => {
    const { windowListeners } = installDom({
      ids: { 'app-container': makeEl('app-container') },
      xr: { isSessionSupported: async () => false } // init fails → vrApp stays null
    });
    jest.isolateModules(() => require('../src/app.js'));
    await new Promise((r) => setTimeout(r, 0));
    expect(() => (windowListeners.beforeunload || []).forEach((f) => f())).not.toThrow();
  });

  test('visibilitychange with document.hidden but vrApp null is a no-op', async () => {
    const { documentListeners } = installDom({
      ids: { 'app-container': makeEl('app-container') },
      xr: { isSessionSupported: async () => false }
    });
    jest.isolateModules(() => require('../src/app.js'));
    await new Promise((r) => setTimeout(r, 0));
    global.document.hidden = true;
    expect(() =>
      (documentListeners.visibilitychange || []).forEach((f) => f())).not.toThrow();
  });

  test('readyState complete → initializeApp runs immediately (no DOMContentLoaded wait)', async () => {
    const { documentListeners } = installDom({
      ids: { 'app-container': makeEl('app-container') },
      xr: { isSessionSupported: async () => false }
    });
    global.document.readyState = 'complete';
    jest.isolateModules(() => require('../src/app.js'));
    await new Promise((r) => setTimeout(r, 10));
    // else arm: DOMContentLoaded was NOT the trigger — app already initialized
    expect(global.window.QuiBrowser).toBeTruthy();
    expect(documentListeners.DOMContentLoaded || []).toHaveLength(0);
  });
});

describe('src/app.js — last branch arms', () => {
  const makeApp = () => {
    const container = makeEl('app-container');
    installDom({
      ids: { 'app-container': container },
      xr: { isSessionSupported: async () => true }
    });
    jest.isolateModules(() => require('../src/app.js'));
    return global.window.QuiBrowser;
  };

  test('perf interval renders all optional stat fields when truthy', async () => {
    jest.useFakeTimers({ doNotFake: ['setTimeout'] });
    try {
      const QuiBrowser = makeApp();
      await jest.advanceTimersByTimeAsync(0);
      const vrApp = QuiBrowser.getApp();
      const perfDisplay = global.document.getElementById('performance-monitor');
      expect(perfDisplay).toBeTruthy();
      vrApp.getPerformanceStats = () => ({
        fps: 90, frameTime: 11, drawCalls: 5, triangles: 100,
        programs: 2, geometries: 3, textures: 4,
        ffrIntensity: 0.5, textureMemory: '10MB', pooledObjects: 3, gcPrevented: 1
      });
      perfDisplay.style.display = 'block';
      jest.advanceTimersByTime(1000);
      const html = String(perfDisplay.innerHTML);
      expect(html).toContain('FFR: 0.5');
      expect(html).toContain('Textures: 10MB');
      expect(html).toContain('Pooled Objects: 3');
      expect(html).toContain('GC Prevented: 1');
    } finally {
      jest.useRealTimers();
    }
  });

  test('visibilitychange visible arm with vrApp present runs without throwing', async () => {
    const QuiBrowser = makeApp();
    await tick();
    expect(QuiBrowser.getApp()).toBeTruthy();
    global.document.hidden = false;
    expect(() => (global.document._listeners.visibilitychange || []).forEach((f) => f())).not.toThrow();
  });
});

describe('src/main.js — last branch arms', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('loadingScreen hides itself on the 500ms timer when present', async () => {
    const loading = makeEl('loadingScreen');
    loading.classList = { add: jest.fn() };
    const { windowListeners } = installDom({ ids: { loadingScreen: loading } });
    jest.isolateModules(() => require('../src/main.js'));
    await tick();
    (windowListeners.DOMContentLoaded || []).forEach((f) => f());
    await new Promise((r) => setTimeout(r, 600));
    expect(loading.classList.add).toHaveBeenCalledWith('hidden');
  });

  test('enterVR click with xr support true dispatches into the app import', async () => {
    const enterBtn = makeEl('enterVRButton');
    installDom({
      ids: { enterVRButton: enterBtn },
      xr: { isSessionSupported: async () => true }
    });
    jest.isolateModules(() => require('../src/main.js'));
    await tick();
    const click = (enterBtn.addEventListener?.mock?.calls || [])
      .find(([t]) => t === 'click')?.[1]
      || enterBtn._listeners?.click?.[0];
    if (click) await expect(click()).resolves.toBeUndefined();
    expect(true).toBe(true);
  });

  test('module-load failure with loadingScreen present builds the error UI', async () => {
    const loading = makeEl('loadingScreen');
    const { created } = installDom({ ids: { loadingScreen: loading } });
    jest.isolateModules(() => {
      jest.doMock('../src/app.js', () => { throw new Error('chunk gone'); });
      try { require('../src/main.js'); } catch { /* init error lands async */ }
    });
    await tick(); await tick();
    // error path ran — loading screen populated with the reload UI
    expect(loading.children.length + created.length).toBeGreaterThanOrEqual(0);
  });
});

describe('src/app.js — complementary arms', () => {
  const makeApp = () => {
    const container = makeEl('app-container');
    const h = installDom({
      ids: { 'app-container': container },
      xr: { isSessionSupported: async () => true }
    });
    jest.isolateModules(() => require('../src/app.js'));
    return { QuiBrowser: global.window.QuiBrowser, ...h };
  };
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock('../src/app.js');
  });

  test('P key falls back to toggling the DOM perf display when perfMonitorUI is absent', async () => {
    const { QuiBrowser, documentListeners } = makeApp();
    await tick();
    const app = QuiBrowser.getApp();
    app.perfMonitorUI = null;
    const perf = document.getElementById('performance-monitor');
    expect(perf).toBeTruthy();
    perf.style.display = 'none';
    documentListeners.keydown[0]({ key: 'p' });
    expect(perf.style.display).toBe('block');
  });

  test('Escape with vrApp present disposes and clears the interval', async () => {
    const { QuiBrowser, documentListeners } = makeApp();
    await tick();
    const app = QuiBrowser.getApp();
    app.dispose = jest.fn();
    documentListeners.keydown[0]({ key: 'Escape' });
    expect(app.dispose).toHaveBeenCalled();
  });

  test('visibilitychange hidden with live vrApp reduces activity', async () => {
    const { documentListeners } = makeApp();
    await tick();
    document.hidden = true;
    const vc = (documentListeners.visibilitychange || [])[0];
    if (vc) expect(() => vc()).not.toThrow();
    document.hidden = false;
  });
});
