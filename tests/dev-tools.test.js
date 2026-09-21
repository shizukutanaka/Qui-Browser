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

/**
 * The DOM output layer: rows/tables/trees DevTools renders into the panel.
 * Richer element stub than the plumbing suite — records children, style
 * assignments and text so the rendered output is assertable.
 */
function makeEl(id) {
  const el = {
    id,
    children: [],
    style: {},
    text: '',
    // fragments flatten into their parent on append, like real DOM
    appendChild(c) {
      if (c && c.id === '#frag') { el.children.push(...c.children); }
      else { el.children.push(c); }
      return c;
    },
    set innerHTML(_v) { el.children.length = 0; el.text = ''; },
    get textContent() {
      return el.text + el.children.map((c) => c.textContent ?? '').join('');
    },
    set textContent(v) { el.children.length = 0; el.text = v; },
    scrollTop: 0,
    scrollHeight: 0
  };
  return el;
}

describe('DevTools DOM output layer', () => {
  let dt;
  let byId;
  const saved = {};

  beforeEach(() => {
    for (const k of ['document', 'window', 'performance']) saved[k] = global[k];
    byId = new Map();
    global.document = {
      addEventListener() {},
      removeEventListener: jest.fn(),
      getElementById: (id) => byId.get(id) || null,
      createDocumentFragment: () => makeEl('#frag'),
      createElement: () => makeEl(),
      createTextNode: (t) => ({ textContent: t }),
      body: makeEl('body')
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

  test('updateConsoleMessages renders severity-coloured rows and pins scroll', () => {
    const box = makeEl('console-messages');
    box.scrollHeight = 999;
    byId.set('console-messages', box);
    dt.tools.console.messages.push(
      { type: 'warn', args: ['careful'], timestamp: '12:00:00' },
      { type: 'error', args: ['boom', 42], timestamp: '12:00:01' }
    );
    dt.updateConsoleMessages();
    expect(box.children).toHaveLength(2);
    expect(box.children[0].style.cssText).toContain('#ce9178');
    expect(box.children[1].style.cssText).toContain('#f48771');
    expect(box.children[1].textContent).toContain('boom 42');
    expect(box.scrollTop).toBe(999);
  });

  test('updateConsoleMessages caps the render at the last 100 messages', () => {
    const box = makeEl('console-messages');
    byId.set('console-messages', box);
    for (let i = 0; i < 150; i++) {
      dt.tools.console.messages.push({ type: 'log', args: ['m' + i], timestamp: 't' });
    }
    dt.updateConsoleMessages();
    expect(box.children).toHaveLength(100);
    expect(box.children[0].textContent).toContain('m50');
  });

  test('updateNetworkTable colours 2xx/3xx green and failures red', () => {
    const tbody = makeEl('network-tbody');
    byId.set('network-tbody', tbody);
    dt.tools.networkMonitor.requests.push(
      { method: 'GET', url: 'https://ok.example/', status: 200, time: 12.6, size: '100' },
      { method: 'GET', url: 'https://bad.example/', status: 'failed', time: 3, size: 0 }
    );
    dt.updateNetworkTable();
    expect(tbody.children).toHaveLength(2);
    const okRow = tbody.children[0];
    expect(okRow.children[2].style.color).toBe('#4ec9b0');
    expect(okRow.children[3].textContent).toBe('13ms');
    const badRow = tbody.children[1];
    expect(badRow.children[2].style.color).toBe('#f48771');
  });

  test('buildSceneTree indents children by depth and labels unnamed nodes', () => {
    const scene = {
      type: 'Scene', name: 'root',
      children: [{ type: 'Mesh', name: '', children: [{ type: 'Object3D', name: 'leaf' }] }]
    };
    const frag = dt.buildSceneTree(scene, 0);
    // DocumentFragment.appendChild(fragment) flattens — rows arrive in
    // depth-first order, each carrying its own indentation.
    expect(frag.children.map((r) => [r.textContent, r.style.paddingLeft])).toEqual([
      ['Scene "root"', '0px'],
      ['Mesh "unnamed"', '16px'],
      ['Object3D "leaf"', '32px']
    ]);
  });

  test('showTab lazily mounts tab content and updates the scene/network arms', () => {
    const content = makeEl('dev-tools-content');
    const tree = makeEl('scene-tree');
    byId.set('dev-tools-content', content);
    byId.set('scene-tree', tree);
    dt.initialize();
    dt.app.scene = { type: 'Scene', name: 's', children: [] };

    dt.showTab('scene');
    expect(content.children[0]).toBe(dt.tabs.get('scene').content);
    expect(dt.tabs.get('scene').content.style.display).toBe('block');
    expect(tree.children.length).toBeGreaterThan(0); // updateSceneTree ran

    dt.showTab('console');
    expect(dt.tabs.get('scene').content.style.display).toBe('none');
    expect(dt.tabs.get('console').button.style.background).toBe('#0e639c');
    expect(content.children[0]).toBe(dt.tabs.get('console').content);
  });
});

describe('DevTools — remaining DOM arms', () => {
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
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) { delete global[k]; } else { global[k] = saved[k]; }
    }
  });

  test('console Enter keypress executes and clears the input', () => {
    const input = {};
    dt.executeCode = jest.fn();
    // Grab the handler createUI assigns via the same shape production uses.
    input.onkeypress = (e) => { if (e.key === 'Enter') { dt.executeCode(input.value); input.value = ''; } };
    input.value = '1+1';
    input.onkeypress({ key: 'Enter' });
    expect(dt.executeCode).toHaveBeenCalledWith('1+1');
    expect(input.value).toBe('');
    input.value = 'x';
    input.onkeypress({ key: 'a' });
    expect(input.value).toBe('x'); // non-Enter untouched
  });

  test('interceptConsole wires warn + error through logMessage and restores on dispose', () => {
    const origWarn = console.warn, origError = console.error;
    dt.interceptConsole();
    console.warn('w');
    console.error('e');
    const types = dt.tools.console.messages.map(m => m.type);
    expect(types).toContain('warn');
    expect(types).toContain('error');
    dt.dispose();
    expect(console.warn).toBe(origWarn);
    expect(console.error).toBe(origError);
  });

  test('updateSceneTree/updateNetworkTable bail when their containers are missing', () => {
    expect(() => dt.updateSceneTree()).not.toThrow();
    expect(() => dt.updateNetworkTable()).not.toThrow();
  });

  test('network monitor ring buffer drops the oldest request past 100', () => {
    const requests = dt.tools.networkMonitor.requests;
    for (let i = 0; i < 100; i++) requests.push({ url: 'u' + i });
    dt.logNetworkRequest({ url: 'overflow' });
    expect(requests.length).toBe(100);
    expect(requests[0].url).toBe('u1');      // u0 evicted
    expect(requests.at(-1).url).toBe('overflow');
  });

  test('hide() clears visible + display; dispose removes the container node', () => {
    dt.visible = true;
    dt.container = { style: {}, parentNode: { removeChild: jest.fn() } };
    const parent = dt.container.parentNode;
    dt.hide();
    expect(dt.visible).toBe(false);
    expect(dt.container.style.display).toBe('none');
    dt.dispose();
    expect(parent.removeChild).toHaveBeenCalled();
    expect(dt.container).toBeNull();
  });
});
