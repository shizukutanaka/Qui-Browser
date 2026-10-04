/**
 * DevTools dead-surface pins (round 849).
 *
 * DevTools shipped speculative tool slots (sceneInspector / profiler /
 * logger / debugger) whose state was never read or written after the
 * constructor, plus two keyboard shortcuts pointing at methods that were
 * never implemented — pressing them threw TypeError inside the keydown
 * handler (Ctrl+Shift+C -> selectElement, Ctrl+Shift+P -> showProfiler).
 * The profiler and settings tabs were stub UI whose controls had no
 * listeners. Only the working surface remains.
 */

const { DevTools } = require('../src/dev/DevTools.js');

const makeDoc = () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
});

const makeDevTools = () => {
  global.document = makeDoc();
  return new DevTools({});
};

afterEach(() => {
  delete global.document;
});

describe('DevTools — dead speculative tool slots removed', () => {
  test('only the consumed tools state remains', () => {
    const dt = makeDevTools();
    expect(dt.tools.sceneInspector).toBeUndefined();
    expect(dt.tools.profiler).toBeUndefined();
    expect(dt.tools.logger).toBeUndefined();
    expect(dt.tools.debugger).toBeUndefined();
    expect(Array.isArray(dt.tools.console.messages)).toBe(true);
    expect(Array.isArray(dt.tools.networkMonitor.requests)).toBe(true);
  });

  test('dead enabled stores are gone', () => {
    const dt = makeDevTools();
    expect(dt.enabled).toBeUndefined();
    expect(dt.tools.console.enabled).toBeUndefined();
    expect(dt.tools.networkMonitor.enabled).toBeUndefined();
  });
});

describe('DevTools — shortcuts all resolve to real methods', () => {
  test('no shortcut points at an unimplemented method', () => {
    const dt = makeDevTools();
    // Ctrl+Shift+C called this.selectElement() and Ctrl+Shift+P called
    // this.showProfiler() — neither existed, so both threw TypeError.
    expect(dt.shortcuts['Ctrl+Shift+C']).toBeUndefined();
    expect(dt.shortcuts['Ctrl+Shift+P']).toBeUndefined();
    expect(dt.shortcuts.F12).toEqual(expect.any(Function));
    expect(dt.shortcuts['Ctrl+Shift+I']).toEqual(expect.any(Function));
  });

  test('every registered shortcut invokes a working method', () => {
    const dt = makeDevTools();
    dt.toggle = jest.fn();
    dt.shortcuts.F12();
    dt.shortcuts['Ctrl+Shift+I']();
    expect(dt.toggle).toHaveBeenCalledTimes(2);
  });
});

describe('DevTools — stub UI tabs removed', () => {
  test('profiler and settings tabs (listenerless controls) are gone', () => {
    const dt = makeDevTools();
    expect(typeof dt.createProfilerTab).toBe('undefined');
    expect(typeof dt.createSettingsTab).toBe('undefined');
    // Working tabs remain: console REPL, scene tree, network table.
    expect(typeof dt.createConsoleTab).toBe('function');
    expect(typeof dt.createSceneTab).toBe('function');
    expect(typeof dt.createNetworkTab).toBe('function');
  });
});
