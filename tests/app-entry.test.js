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
function installDom({ ids = {}, xr = null } = {}) {
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
    getElementById: (id) => ids[id] || null,
    createElement: (tag) => { const el = makeEl(tag); created.push(el); return el; },
    querySelectorAll: () => ({ forEach: () => {} }),
    addEventListener: (type, fn) => { (documentListeners[type] ||= []).push(fn); },
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  };
  global.navigator = xr ? { xr } : {};
  global.window = {
    navigator: global.navigator, // window.navigator === navigator in browsers
    addEventListener: (type, fn) => { (windowListeners[type] ||= []).push(fn); },
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    matchMedia: () => ({ matches: false }),
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
});
