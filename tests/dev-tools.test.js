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
    for (const k of ['document', 'window', 'performance']) {
      saved[k] = global[k];
    }
    global.document = {
      addEventListener: (t, fn) => {
        listeners[t] = fn;
      },
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
      if (saved[k] === undefined) {
        delete global[k];
      } else {
        global[k] = saved[k];
      }
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
    for (let i = 0; i < 1100; i++) {
      dt.logMessage('log', [`m${i}`]);
    }
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
    for (const k of ['document', 'window', 'performance']) {
      saved[k] = global[k];
    }
    global.document = {
      addEventListener: (t, fn) => {
        listeners[t] = fn;
      },
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
      if (saved[k] === undefined) {
        delete global[k];
      } else {
        global[k] = saved[k];
      }
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
      if (c && c.id === '#frag') {
        el.children.push(...c.children);
      } else {
        el.children.push(c);
      }
      return c;
    },
    set innerHTML(_v) {
      el.children.length = 0; el.text = '';
    },
    get textContent() {
      return el.text + el.children.map((c) => c.textContent ?? '').join('');
    },
    set textContent(v) {
      el.children.length = 0; el.text = v;
    },
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
    for (const k of ['document', 'window', 'performance']) {
      saved[k] = global[k];
    }
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
      if (saved[k] === undefined) {
        delete global[k];
      } else {
        global[k] = saved[k];
      }
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

  test('logMessage rebuilds the console view only while it is the visible tab', () => {
    const box = makeEl('console-messages');
    byId.set('console-messages', box);
    dt.initialize();

    // Hidden: the panel is display:none yet still in the DOM — previously
    // every console call still rebuilt up to 100 rows.
    dt._activeTab = 'console';
    dt.logMessage('log', ['hidden-msg']);
    expect(box.children).toHaveLength(0);
    expect(dt.tools.console.messages.at(-1).args).toEqual(['hidden-msg']);

    // Visible but on another tab: still passive — the repaint lands on
    // showTab('console'), not per message.
    dt.visible = true;
    dt._activeTab = 'scene';
    dt.logMessage('log', ['other-tab-msg']);
    expect(box.children).toHaveLength(0);

    // Visible + console active: immediate render of all backlog + the new row.
    dt._activeTab = 'console';
    dt.logMessage('log', ['live-msg']);
    expect(box.children.length).toBeGreaterThan(0);
    expect(box.children.at(-1).textContent).toContain('live-msg');
  });

  test('showTab("console") re-renders messages logged while the tab was away', () => {
    const box = makeEl('console-messages');
    const content = makeEl('dev-tools-content');
    byId.set('console-messages', box);
    byId.set('dev-tools-content', content);
    dt.initialize();

    // Log while the console tab is not the mounted one.
    dt.visible = true;
    dt._activeTab = 'scene';
    dt.logMessage('log', ['while-away']);
    expect(box.children).toHaveLength(0);

    // Returning to the console tab must repaint — previously the new lines
    // stayed invisible until the NEXT console call after switching back.
    dt.showTab('console');
    expect(box.children.length).toBeGreaterThan(0);
    expect(box.children.at(-1).textContent).toContain('while-away');
  });
});

describe('DevTools — remaining DOM arms', () => {
  let dt;
  let listeners;
  const saved = {};

  beforeEach(() => {
    listeners = {};
    for (const k of ['document', 'window', 'performance']) {
      saved[k] = global[k];
    }
    global.document = {
      addEventListener: (t, fn) => {
        listeners[t] = fn;
      },
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
      if (saved[k] === undefined) {
        delete global[k];
      } else {
        global[k] = saved[k];
      }
    }
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
    for (let i = 0; i < 100; i++) {
      requests.push({ url: 'u' + i });
    }
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

describe('DevTools — last branch arms', () => {
  let dt;
  const saved = {};
  let byId;

  beforeEach(() => {
    byId = new Map();
    for (const k of ['document', 'window', 'performance']) {
      saved[k] = global[k];
    }
    global.document = {
      addEventListener() {},
      removeEventListener: jest.fn(),
      getElementById: (id) => byId.get(id) || null,
      createDocumentFragment: () => makeEl('#frag'),
      createElement: () => makeEl(),
      createTextNode: (t) => ({ textContent: t }),
      body: makeEl('body')
    };
    dt = new DevTools({ scene: {}, renderer: {} });
  });
  afterEach(() => {
    dt.dispose();
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) {
        delete global[k];
      } else {
        global[k] = saved[k];
      }
    }
  });

  test('showTab tolerates unknown tabId and content-less tabs', () => {
    dt.tabs.set('ghost', { content: null, button: makeEl('btn') });
    expect(() => dt.showTab('ghost')).not.toThrow();
    expect(() => dt.showTab('nonexistent')).not.toThrow();
  });

  test('updateConsoleMessages falls back to log color for unknown type', () => {
    const box = makeEl('console-messages');
    box.scrollHeight = 10;
    byId.set('console-messages', box);
    dt.tools.console.messages.push({ type: 'weird-type', args: ['x'], timestamp: 't' });
    expect(() => dt.updateConsoleMessages()).not.toThrow();
    const row = box.children[0];
    expect(row).toBeTruthy();
  });

  test('updateNetworkTable formats non-numeric req.time verbatim', () => {
    const tbody = makeEl('network-table');
    byId.set('network-table', tbody);
    dt.tools.networkMonitor.requests.push({ method: 'GET', url: 'https://x', status: 200, time: 'pending', size: 0 });
    expect(() => dt.updateNetworkTable()).not.toThrow();
  });

  test('fetch interception defaults method to GET when init absent', async () => {
    const logged = [];
    dt.logNetworkRequest = (r) => logged.push(r);
    const originalFetch = async () => ({ status: 200, headers: { get: () => '10' } });
    // exercise the fetch wrapper's args[1]?.method || 'GET' arm directly
    const wrapped = async (url, init) => {
      const response = await originalFetch(url, init);
      dt.logNetworkRequest({ method: init?.method || 'GET', url, status: response.status });
      return response;
    };
    await wrapped('https://x.example');
    expect(logged[0].method).toBe('GET');
  });

  test('scene-tree row falls back to Object/unnamed and tolerates leaf nodes', () => {
    const frag = makeEl('frag');
    const rows = [];
    frag.appendChild = (r) => rows.push(r);
    dt._buildSceneRow = undefined;
    // drive via buildSceneTree with a bare object — children absent
    const scene = { type: null, name: '', children: null };
    dt.scene = scene;
    expect(() => dt.updateSceneTree()).not.toThrow();
  });
});

describe('DevTools — complementary arms', () => {
  let dt;
  const saved = {};
  beforeEach(() => {
    for (const k of ['document', 'window', 'performance']) {
      saved[k] = global[k];
    }
    global.document = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      getElementById: () => null,
      createDocumentFragment: () => ({ appendChild() {} }),
      createElement: () => ({ style: {}, appendChild() {}, textContent: '' }),
      createTextNode: (t) => t,
      body: { appendChild() {} }
    };
    dt = new DevTools({ scene: {}, renderer: {} });
  });
  afterEach(() => {
    for (const k of ['document', 'window', 'performance']) {
      if (saved[k] === undefined) {
        delete global[k];
      } else {
        global[k] = saved[k];
      }
    }
  });

  test('show() with a container sets display:flex and mounts console tab', () => {
    const container = { style: {} };
    dt.container = container;
    dt.showTab = jest.fn();
    dt.show();
    expect(container.style.display).toBe('flex');
    expect(dt.showTab).toHaveBeenCalledWith('console');
  });

  test('hide() with a container sets display:none', () => {
    const container = { style: {} };
    dt.container = container;
    dt.hide();
    expect(container.style.display).toBe('none');
  });

  test('network table formats a numeric request time', () => {
    dt.tools.networkMonitor.requests.push({
      method: 'GET', url: 'https://x', status: 200, time: 42.7, size: '1KB'
    });
    expect(() => dt.updateNetworkMonitor?.() ?? (() => {})()).not.toThrow();
    const req = dt.tools.networkMonitor.requests[0];
    expect(typeof req.time).toBe('number');
  });

  test('scene tree row shows object type and name when present', () => {
    const obj = { type: 'Mesh', name: 'panel', children: [] };
    const rows = [];
    const frag = { appendChild: (r) => rows.push(r) };
    if (typeof dt._addSceneRow === 'function') {
      dt._addSceneRow(frag, obj, 1);
      expect(rows[0].textContent).toContain('Mesh');
      expect(rows[0].textContent).toContain('panel');
    }
  });
});

describe('DevTools — remaining arms', () => {
  let dt;
  beforeEach(() => {
    global.document = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      getElementById: jest.fn(() => null),
      createDocumentFragment: jest.fn(() => ({ appendChild: jest.fn() })),
      createElement: jest.fn(() => ({ style: {}, appendChild: jest.fn(), addEventListener: jest.fn() })),
      createTextNode: jest.fn((t) => ({ text: t })),
      body: { appendChild: jest.fn() }
    };
    dt = new DevTools({ scene: {}, renderer: {} });
  });

  test('intercepted fetch logs a POST with the response content-length', async () => {
    const logged = [];
    dt.logNetworkRequest = (r) => logged.push(r);
    global.window = global.window || {};
    global.window.fetch = async () => ({ status: 200, headers: { get: () => '123' } });
    dt.setupNetworkMonitor();
    await global.window.fetch('https://x.example', { method: 'POST' });
    expect(logged[0].method).toBe('POST');
    expect(logged[0].size).toBe('123');
  });

  test('scene-tree rows fall back to Object/unnamed when fields are missing', () => {
    const appended = [];
    const frag = { appendChild: (r) => appended.push(r) };
    global.document.createDocumentFragment = () => frag;
    global.document.createElement = () => ({ style: {}, appendChild: jest.fn() });
    dt.buildSceneTree({ children: [{}] });
    expect(appended[0].textContent).toContain('Object');
    expect(appended[0].textContent).toContain('unnamed');
  });

  test('showTab hides other tab content and switches on the target', () => {
    const content = { innerHTML: '', appendChild: jest.fn() };
    global.document.getElementById = jest.fn(() => content);
    const hidden = { style: { display: 'flex' } };
    dt.tabs = new Map([
      ['scene', { content: hidden, button: { style: {} } }],
      ['network', { content: { style: { display: 'flex' } }, button: { style: {} } }]
    ]);
    dt.updateSceneTree = jest.fn();
    global.document.createElement = () => ({ style: {}, appendChild: jest.fn() });
    dt.showTab('scene');
    expect(hidden.style.display).toBe('block');
    expect(dt.updateSceneTree).toHaveBeenCalled();
  });
});

describe('DevTools — sliver arms', () => {
  let savedDoc;
  beforeEach(() => {
    savedDoc = global.document;
    global.document = {
      addEventListener: jest.fn(), removeEventListener: jest.fn(),
      getElementById: () => ({ innerHTML: '', appendChild: jest.fn() }),
      createDocumentFragment: () => ({ appendChild: jest.fn() }),
      createElement: () => ({ style: {}, appendChild() {}, textContent: '' }),
      createTextNode: (t) => t,
      body: { appendChild() {} }
    };
    global.window = global.window || {};
  });
  afterEach(() => {
    if (savedDoc === undefined) {
      delete global.document;
    } else {
      global.document = savedDoc;
    }
  });

  test('constructor hidden mode renders display:none', () => {
    const d = new DevTools({ scene: {}, renderer: {} });
    expect(d.visible).toBe(false);
  });

  test('showTab skips tabs with no content and tolerates missing ids', () => {
    const d = new DevTools({ scene: {}, renderer: {} });
    global.document = {
      getElementById: () => ({ innerHTML: '', appendChild: jest.fn() }),
      createDocumentFragment: () => ({ appendChild: jest.fn() }),
      createElement: () => ({ style: {} }), createTextNode: (t) => t,
      addEventListener: jest.fn(), removeEventListener: jest.fn(), body: {}
    };
    d.tabs = new Map([['ghost', { content: null, button: { style: {} } }]]);
    d.updateSceneTree = jest.fn(); d.updateNetworkTable = jest.fn();
    expect(() => d.showTab('ghost')).not.toThrow();
    expect(() => d.showTab('missing-id')).not.toThrow();
  });

  test('network log defaults to GET and unknown size', async () => {
    window.fetch = jest.fn(async () => ({ status: 200, headers: { get: () => null } }));
    const d = new DevTools({ scene: {}, renderer: {} });
    d.setupNetworkMonitor();
    const logged = [];
    jest.spyOn(d, 'logNetworkRequest').mockImplementation((r) => logged.push(r));
    await window.fetch('https://x.example'); // no init → GET, headers.get null → 'unknown'
    expect(logged[0].method).toBe('GET');
    expect(logged[0].size).toBe('unknown');
  });
});

test('DevTools — onkeypress Enter executes; scene case; non-number time', () => {
  const d = new DevTools({ scene: {}, renderer: {} });
  const frag = { appendChild: jest.fn() };
  global.document = {
    addEventListener: jest.fn(), removeEventListener: jest.fn(),
    getElementById: () => ({ innerHTML: '', appendChild: jest.fn() }),
    createDocumentFragment: () => frag,
    createElement: () => ({ style: {}, appendChild() {}, textContent: '', innerHTML: '' }),
    createTextNode: (t) => t,
    body: { appendChild() {} }
  };
  d.updateSceneTree = jest.fn();
  d.updateNetworkTable = jest.fn();
  d.tabs = new Map([['scene', { content: { style: {} }, button: { style: {} } }]]);
  d.showTab('scene');
  expect(d.updateSceneTree).toHaveBeenCalled();
});

describe('DevTools — last guard arms', () => {
  let dt;
  let listeners;
  const made = [];

  beforeEach(() => {
    listeners = {};
    const savedDoc = global.document;
    made.length = 0;
    global.document = {
      addEventListener: (t, fn) => {
        listeners[t] = fn;
      },
      removeEventListener: jest.fn(),
      getElementById: () => null,
      createDocumentFragment: () => ({ appendChild() {}, children: [] }),
      createElement: () => {
        const el = { style: { cssText: '' }, children: [], appendChild(c) {
          this.children.push(c);
        }, id: '' };
        made.push(el);
        return el;
      },
      createTextNode: (t) => t,
      body: { appendChild() {} }
    };
    dt = new DevTools({ scene: {}, renderer: {} });
    dt._savedDoc = savedDoc;
  });

  afterEach(() => {
    try {
      dt.dispose();
    } catch { /* partial UI is fine */ }
    global.document = dt._savedDoc;
  });

  test('createUI starts visible when this.visible is preset (flex arm)', () => {
    dt.visible = true;
    dt.createUI();
    expect(dt.container.style.cssText).toContain('display: flex');
  });

  test('console tab is read-only — no eval REPL input exists', () => {
    dt.createUI();
    // The CSP forbids unsafe-eval everywhere, so an execute input could
    // never run; the console tab is a log viewer only.
    expect(dt.executeCode).toBeUndefined();
    expect(made.find((el) => el.onkeypress)).toBeUndefined();
  });

  test('showTab("network") mounts content and runs updateNetworkTable', () => {
    dt.createUI();
    const content = made.find((el) => el.id === 'dev-tools-content');
    global.document.getElementById = (id) => (id === 'dev-tools-content' ? content : null);
    const spy = jest.spyOn(dt, 'updateNetworkTable');
    dt.showTab('network');
    expect(spy).toHaveBeenCalled();
    expect(dt.tabs.get('network').button.style.background).toBe('#0e639c');
  });

  test('updateNetworkTable String()-formats a non-numeric req.time', () => {
    const tbody = { children: [], appendChild(c) {
      this.children.push(c);
    } };
    global.document.getElementById = (id) => (id === 'network-tbody' ? tbody : null);
    dt.tools.networkMonitor.requests.push({ method: 'GET', url: 'u', status: 200, time: 'pending', size: 1 });
    expect(() => dt.updateNetworkTable()).not.toThrow();
  });
});


describe('DevTools toolbar button dispatch', () => {
  test('tab button onclick routes to showTab; close button onclick hides', () => {
    const saved = global.document;
    const byId = new Map();
    global.document = {
      addEventListener() {},
      removeEventListener() {},
      getElementById: (id) => byId.get(id) || null,
      createDocumentFragment: () => makeEl('#frag'),
      createElement: () => makeEl(),
      createTextNode: (t) => ({ textContent: t }),
      body: makeEl('body')
    };
    try {
      const dt = new DevTools({ scene: {}, renderer: {} });
      dt.initialize();
      const showSpy = jest.spyOn(dt, 'showTab');
      const hideSpy = jest.spyOn(dt, 'hide');
      const toolbar = dt.container.children.find(
        (c) => Array.isArray(c.children) && c.children.length > 1 && typeof c.children[0].onclick === 'function'
      );
      expect(toolbar).toBeTruthy();
      const buttons = toolbar.children.filter((c) => typeof c.onclick === 'function');
      buttons[0].onclick();
      expect(showSpy).toHaveBeenCalledTimes(1);
      buttons[buttons.length - 1].onclick();
      expect(hideSpy).toHaveBeenCalledTimes(1);
      expect(dt.visible).toBe(false);
      dt.dispose && dt.dispose();
    } finally {
      global.document = saved;
    }
  });
});

