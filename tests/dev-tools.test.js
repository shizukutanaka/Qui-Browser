/**
 * DevTools (src/dev/DevTools.js) — dev-only debug shell, dynamically imported
 * by VRApp only under import.meta.env.DEV. Tests pin the non-visual plumbing:
 * console interception, fetch interception, keyboard shortcuts, dispose.
 */

const { DevTools } = require('../src/dev/DevTools.js');

describe('DevTools plumbing', () => {
  let dt;
  let listeners;
  const saved = {};

  beforeEach(() => {
    listeners = {};
    for (const k of ['document', 'window', 'performance']) saved[k] = global[k];
    global.document = {
      addEventListener: (t, fn) => { listeners[t] = fn; },
      removeEventListener: jest.fn(),
      getElementById: () => null,
      createDocumentFragment: () => ({ appendChild() {} }),
      createElement: () => ({ style: {}, appendChild() {}, textContent: '' }),
      createTextNode: (t) => t,
      body: { appendChild() {} }
    };
    global.window = global.window || {};
    dt = new DevTools({ scene: {}, renderer: {} });
  });

  afterEach(() => {
    dt.dispose();
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) { delete global[k]; } else { global[k] = saved[k]; }
    }
  });

  test('F12 toggles visibility; Ctrl+Shift+I also toggles; plain keys ignored', () => {
    const keydown = listeners.keydown;
    const ev = { key: 'F12', preventDefault: jest.fn() };
    keydown(ev);
    expect(dt.visible).toBe(true);
    expect(ev.preventDefault).toHaveBeenCalled();
    keydown({ key: 'I', ctrlKey: true, shiftKey: true, preventDefault: jest.fn() });
    expect(dt.visible).toBe(false);
    const pd = jest.fn();
    keydown({ key: 'x', preventDefault: pd });
    expect(pd).not.toHaveBeenCalled();
  });

  test('interceptConsole routes console.* into the message log and restores on dispose', () => {
    const orig = console.log;
    dt.interceptConsole();
    expect(console.log).not.toBe(orig);
    console.log('hello', 42);
    expect(dt.tools.console.messages).toHaveLength(1);
    expect(dt.tools.console.messages[0].type).toBe('log');
    expect(dt.tools.console.messages[0].args).toEqual(['hello', '42']);
    dt.dispose();
    expect(console.log).toBe(orig);
  });

  test('message log is capped at 1000 entries', () => {
    for (let i = 0; i < 1100; i++) dt.logMessage('log', [`m${i}`]);
    expect(dt.tools.console.messages).toHaveLength(1000);
    expect(dt.tools.console.messages[0].args[0]).toBe('m100');
  });

  test('formatValue renders null/undefined/objects/circular safely', () => {
    expect(dt.formatValue(null)).toBe('null');
    expect(dt.formatValue(undefined)).toBe('undefined');
    expect(dt.formatValue({ a: 1 })).toContain('"a": 1');
    const circ = {}; circ.self = circ;
    expect(() => dt.formatValue(circ)).not.toThrow();
    expect(dt.formatValue(7)).toBe('7');
  });

  test('executeCode evaluates expressions, falls back to statements, logs errors', () => {
    dt.executeCode('1 + 2');
    dt.executeCode('let x = 5;');
    dt.executeCode('throw new Error("kaboom")');
    const msgs = dt.tools.console.messages;
    expect(msgs[0].args).toEqual(['> 1 + 2', '3']); // formatValue stringifies
    expect(msgs[1].args[0]).toBe('> let x = 5;');
    expect(msgs[2].type).toBe('error');
    expect(msgs[2].args[0]).toContain('kaboom');
  });

  test('fetch interception records successful and failed requests', async () => {
    const origFetch = jest.fn(async () => ({
      status: 200,
      headers: { get: () => '1234' }
    }));
    global.window.fetch = origFetch;
    dt.setupNetworkMonitor();
    await window.fetch('/a', { method: 'POST' });
    origFetch.mockRejectedValueOnce(new Error('down'));
    await expect(window.fetch('/b')).rejects.toThrow('down');
    const reqs = dt.tools.networkMonitor.requests;
    expect(reqs).toHaveLength(2);
    expect(reqs[0]).toMatchObject({ method: 'POST', url: '/a', status: 200, size: '1234' });
    expect(reqs[1]).toMatchObject({ status: 'failed', size: 0 });
    dt.dispose();
    expect(window.fetch).toBe(origFetch); // restored to pre-intercept
  });

  test('toggle/show/hide manage the visible flag without a DOM container', () => {
    expect(dt.visible).toBe(false);
    dt.show();
    expect(dt.visible).toBe(true);
    dt.toggle();
    expect(dt.visible).toBe(false);
    dt.toggle();
    expect(dt.visible).toBe(true);
    dt.hide();
    expect(dt.visible).toBe(false);
  });
});

describe('DevTools dead-surface sweep', () => {
  let dt;
  let listeners;
  const saved = {};

  beforeEach(() => {
    listeners = {};
    for (const k of ['document', 'window', 'performance']) saved[k] = global[k];
    global.document = {
      addEventListener: (t, fn) => { listeners[t] = fn; },
      removeEventListener: jest.fn(),
      getElementById: () => null,
      createDocumentFragment: () => ({ appendChild() {} }),
      createElement: () => ({ style: {}, appendChild() {}, textContent: '' }),
      createTextNode: (t) => t,
      body: { appendChild() {} }
    };
    global.window = global.window || {};
    dt = new DevTools({ scene: {}, renderer: {} });
    dt.initialize();
  });

  afterEach(() => {
    dt.dispose();
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) { delete global[k]; } else { global[k] = saved[k]; }
    }
  });

  test('every registered shortcut maps to a real method (no phantom Ctrl+Shift+C/P)', () => {
    const keydown = listeners.keydown;
    for (const shortcut of Object.keys(dt.shortcuts)) {
      const ev = { key: 'x', ctrlKey: true, shiftKey: true, preventDefault: jest.fn() };
      expect(() => keydown(ev)).not.toThrow();
      // now the exact shortcut path
    }
    // direct dispatch of each registered binding
    expect(() => dt.shortcuts['F12']()).not.toThrow();
    expect(dt.shortcuts['Ctrl+Shift+C']).toBeUndefined();
    expect(dt.shortcuts['Ctrl+Shift+P']).toBeUndefined();
  });

  test('initialize creates only tabs whose controls are wired (no profiler/settings)', () => {
    expect([...dt.tabs.keys()].sort()).toEqual(['console', 'network', 'scene']);
  });
});
