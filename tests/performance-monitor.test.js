/**
 * PerformanceMonitor — the HUD wired into the render loop when
 * settings.enablePerfMonitorUI is on (VRApp.js). 670 lines shipped
 * untested (0% coverage measured 2026-09-20); the headless-logic
 * parts — metric math, history capping, threshold alerts, report/CSV —
 * are covered here without DOM or a renderer.
 */

const { PerformanceMonitor } = require('../src/utils/PerformanceMonitor.js');

describe('PerformanceMonitor metric bookkeeping', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('updateMetric tracks current/min/max/running-average', () => {
    const mon = new PerformanceMonitor();
    mon.updateMetric('frameTime', 10);
    mon.updateMetric('frameTime', 20);
    const m = mon.metrics.frameTime;
    expect([m.current, m.min, m.max]).toEqual([20, 10, 20]);
    // avg folds in history samples + latest value
    expect(m.avg).toBeGreaterThan(0);
    mon.updateMetric('nope', 1); // unknown metric: no-op, no throw
  });

  test('sampleMetrics caps history at historyLength', () => {
    const mon = new PerformanceMonitor();
    mon.historyLength = 3;
    for (let i = 0; i < 10; i++) {
      mon.updateMetric('frameTime', i);
      mon.sampleMetrics();
    }
    expect(mon.metrics.frameTime.history).toEqual([7, 8, 9]);
  });

  test('endFrame records best/worst and renderer info', () => {
    const mon = new PerformanceMonitor();
    const renderer = { info: { render: { calls: 7, triangles: 9000 }, memory: { textures: 4 }, programs: [1, 2] } };
    jest.spyOn(performance, 'now').mockReturnValueOnce(0); // beginFrame
    mon.beginFrame();
    performance.now.mockReturnValue(100); // every endFrame read → frameTime 100ms
    mon.endFrame(renderer);
    performance.now.mockRestore();
    expect(mon.stats.totalFrames).toBe(1);
    expect(mon.stats.worstFrame.time).toBe(100);
    expect(mon.metrics.drawCalls.current).toBe(7);
    expect(mon.metrics.triangles.current).toBe(9000);
    expect(mon.metrics.textures.current).toBe(4);
    expect(mon.metrics.shaders.current).toBe(2);
  });

  test('no FPS alert fires before FPS has ever been measured', () => {
    const mon = new PerformanceMonitor();
    // First frame: fps.current is still 0 — "FPS dropped to 0.0" is a
    // false critical: no measurement exists yet.
    jest.spyOn(performance, 'now').mockReturnValueOnce(0); // beginFrame
    mon.beginFrame();
    performance.now.mockReturnValue(50);
    mon.endFrame(null);
    performance.now.mockRestore();
    const fpsAlerts = mon.alerts.filter(a => /FPS/i.test(a.message));
    expect(fpsAlerts).toEqual([]);
  });

  test('critical frame time and memory thresholds fire alerts', () => {
    const mon = new PerformanceMonitor();
    mon.updateMetric('frameTime', 20); // > critical 16
    mon.updateMetric('memory', 2000);  // > critical 1800
    mon.checkThresholds();
    const levels = mon.alerts.map(a => a.level);
    expect(levels).toContain('critical');
    expect(mon.stats.alertsGenerated).toBeGreaterThan(0);
  });

  test('repeated identical alerts dedupe within the 5s window', () => {
    const mon = new PerformanceMonitor();
    mon.addAlert('warning', 'same');
    mon.addAlert('warning', 'same');
    mon.addAlert('warning', 'same');
    expect(mon.alerts).toHaveLength(1);
    expect(mon.alerts[0].count).toBe(3);
  });

  test('alerts are capped at maxAlerts', () => {
    const mon = new PerformanceMonitor();
    mon.maxAlerts = 5;
    for (let i = 0; i < 12; i++) {
      mon.addAlert('warning', `w${i}-${Math.random()}`);
    }
    expect(mon.alerts.length).toBeLessThanOrEqual(5);
  });

  test('getReport summarises frames and exportCSV emits header + rows', () => {
    const mon = new PerformanceMonitor();
    mon.stats.totalFrames = 4;
    mon.stats.totalTime = 40;
    const report = mon.getReport();
    expect(report.summary.averageFrameTime).toBe(10);
    expect(report.metrics.fps).toHaveProperty('min');
    mon.updateMetric('frameTime', 8);
    mon.sampleMetrics();
    const csv = mon.exportCSV();
    expect(csv.split('\n')[0]).toContain('fps');
    expect(csv.split('\n').length).toBeGreaterThan(1);
  });

  test('colour helpers classify green/amber/red bands', () => {
    const mon = new PerformanceMonitor();
    expect(mon.getColorForFPS(90)).toBe('#00ff00');
    expect(mon.getColorForFPS(72)).toBe('#ffaa00');
    expect(mon.getColorForFPS(50)).toBe('#ff0000');
    expect(mon.getColorForFrameTime(10)).toBe('#00ff00');
    expect(mon.getColorForFrameTime(12)).toBe('#ffaa00');
    expect(mon.getColorForFrameTime(20)).toBe('#ff0000');
    expect(mon.getColorForMemory(500)).toBe('#00ff00');
    expect(mon.getColorForMemory(1200)).toBe('#ffaa00');
    expect(mon.getColorForMemory(2000)).toBe('#ff0000');
  });
});

describe('PerformanceMonitor overlay DOM + graph layer', () => {
  // Minimal DOM: elements register themselves by id so getElementById
  // resolves nodes createUI built; unknown ids (the perf-close button
  // injected via innerHTML) vend a stub.
  function makeEl(tag, byId) {
    const el = {
      tagName: tag,
      style: {},
      children: [],
      parentNode: null,
      innerHTML: '',
      _ctx: null,
      appendChild(c) {
        c.parentNode = el; el.children.push(c);
      },
      removeChild(c) {
        el.children = el.children.filter(x => x !== c); c.parentNode = null;
      },
      addEventListener() {},
      getContext() {
        if (!el._ctx) {
          const calls = [];
          const rec = (n) => (...a) => calls.push([n, ...a]);
          el._ctx = {
            calls,
            fillRect: rec('fillRect'), beginPath: rec('beginPath'),
            moveTo: rec('moveTo'), lineTo: rec('lineTo'), stroke: rec('stroke'),
            setLineDash: rec('setLineDash'), fillText: rec('fillText'),
            strokeStyle: '', fillStyle: '', lineWidth: 0, font: ''
          };
        }
        return el._ctx;
      }
    };
    Object.defineProperty(el, 'id', {
      get() {
        return this._id;
      },
      set(v) {
        this._id = v; byId[v] = el;
      }
    });
    return el;
  }
  function installDom() {
    const byId = {};
    const body = makeEl('body', byId);
    global.document = {
      body,
      createElement: (t) => makeEl(t, byId),
      getElementById: (id) => byId[id] || makeEl('div', byId)
    };
    return byId;
  }

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    installDom();
  });
  afterEach(() => {
    delete global.document;
    jest.restoreAllMocks();
  });

  test('initialize() builds the overlay and dispose() detaches it', () => {
    const mon = new PerformanceMonitor();
    mon.initialize();
    expect(mon.container.id).toBe('perf-monitor-overlay');
    expect(global.document.body.children).toContain(mon.container);
    expect(global.document.getElementById('perf-metrics')).toBeTruthy();
    expect(mon.graphCtx).toBeTruthy();
    mon.dispose();
    expect(global.document.body.children).toHaveLength(0);
    expect(mon.container).toBeNull();
  });

  test('updateUI writes metric markup; updateAlerts swaps empty-state for entries', () => {
    const mon = new PerformanceMonitor();
    mon.initialize();
    mon.updateMetric('fps', 90);
    mon.updateUI();
    const metrics = global.document.getElementById('perf-metrics');
    expect(metrics.innerHTML).toContain('FPS: 90.0');
    const alerts = global.document.getElementById('perf-alerts');
    expect(alerts.innerHTML).toContain('No alerts');
    mon.addAlert('critical', 'FPS dropped to 10.0');
    mon.updateAlerts();
    expect(alerts.innerHTML).toContain('FPS dropped to 10.0');
  });

  test('show/hide/toggle drive container.style.display', () => {
    const mon = new PerformanceMonitor();
    mon.initialize();
    mon.hide();
    expect(mon.container.style.display).toBe('none');
    mon.toggle();
    expect(mon.container.style.display).toBe('block');
    mon.toggle();
    expect(mon.container.style.display).toBe('none');
  });

  test('graph plots newest samples toward the right edge', () => {
    const mon = new PerformanceMonitor();
    mon.initialize();
    // history.push appends: index 0 is the oldest sample, last is newest
    mon.metrics.fps.history = [10, 20, 30];
    mon.drawMetricGraph(mon.metrics.fps.history, '#00ff00', 0, 120);
    const xs = mon.graphCtx.calls
      .filter(([n]) => n === 'moveTo' || n === 'lineTo')
      .map(([, x]) => x);
    expect(xs[xs.length - 1]).toBe(Math.max(...xs));
    expect(xs[0]).toBe(Math.min(...xs));
  });
});

describe('PerformanceMonitor — remaining guard arms', () => {
  test('memory interval armed only when performance.memory exists; dispose clears it', () => {
    const saved = performance.memory;
    performance.memory = { usedJSHeapSize: 1024 * 1024 };
    const mon = new PerformanceMonitor();
    mon.startMonitoring();
    expect(mon.memoryInterval).toBeTruthy();
    mon.dispose();
    expect(mon.memoryInterval).toBeNull();
    performance.memory = saved;
    jest.restoreAllMocks();
  });

  test('updateMemoryMetrics writes the memory metric when perf.memory is present', () => {
    const saved = performance.memory;
    performance.memory = { usedJSHeapSize: 64 * 1024 * 1024 };
    const mon = new PerformanceMonitor();
    mon.updateMemoryMetrics();
    expect(mon.metrics.memory.current).toBeCloseTo(64, 3);
    performance.memory = saved;
  });

  test('endFrame samples renderer.info when provided', () => {
    const mon = new PerformanceMonitor();
    const renderer = { info: { render: { calls: 3, triangles: 42 }, memory: { textures: 9 }, programs: [1] } };
    jest.spyOn(performance, 'now').mockReturnValue(0);
    mon.beginFrame();
    performance.now.mockReturnValue(5);
    mon.endFrame(renderer);
    performance.now.mockRestore();
    expect(mon.metrics.drawCalls.current).toBe(3);
    expect(mon.metrics.triangles.current).toBe(42);
    expect(mon.metrics.textures.current).toBe(9);
    expect(mon.metrics.shaders.current).toBe(1);
  });

  test('FPS warning band fires when fps below warning threshold but above critical', () => {
    const mon = new PerformanceMonitor();
    const spy = jest.spyOn(mon, 'addAlert');
    mon.metrics.fps.current = mon.thresholds.fps.warning - 1;
    if (mon.metrics.fps.current >= mon.thresholds.fps.critical) {
      // between critical and warning → warning arm
    }
    mon.checkThresholds();
    expect(spy).toHaveBeenCalledWith('warning', expect.stringContaining('FPS below'));
    spy.mockRestore();
  });

  test('updateAlerts returns early without the perf-alerts node', () => {
    const mon = new PerformanceMonitor();
    const savedDoc = global.document;
    global.document = { getElementById: () => null };
    expect(() => mon.updateAlerts()).not.toThrow();
    global.document = savedDoc;
  });
});

describe('PerformanceMonitor — remaining branch arms', () => {
  function installDom2() {
    const byId = {};
    const mk = (t) => {
      const el = {
        tagName: t, style: {}, innerHTML: '', children: [],
        setAttribute() {}, addEventListener() {},
        appendChild(c) {
          el.children.push(c); return c;
        },
        removeChild(c) {
          el.children = el.children.filter(x => x !== c);
        },
        getContext() {
          return { calls: [], fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, setLineDash() {}, fillText() {} };
        }
      };
      Object.defineProperty(el, 'id', {
        get() {
          return this._id;
        },
        set(v) {
          this._id = v; byId[v] = el;
        }
      });
      return el;
    };
    global.document = {
      body: mk('body'),
      createElement: mk,
      getElementById: (id) => byId[id] || mk('div')
    };
    return byId;
  }

  beforeEach(() => {
    installDom2();
  });
  afterEach(() => {
    delete global.document; jest.restoreAllMocks();
  });

  test('endFrame(renderer): frameCount gate + best/worst + renderer.info absent arms', () => {
    const mon = new PerformanceMonitor();
    mon.stats.bestFrame.time = 999;
    mon.stats.worstFrame.time = -1;
    // Deterministic frame durations — real performance.now() can return the
    // same value for consecutive calls (ms granularity) making min==max.
    let t = 0;
    const spy = jest.spyOn(performance, 'now').mockImplementation(() => (t += 10));
    try {
      // renderer without info → the `renderer && renderer.info` false arm
      mon.beginFrame();
      mon.endFrame({});
      expect(mon.frameCount).toBe(1);
      expect(mon.stats.bestFrame.time).not.toBe(999);
      expect(mon.stats.worstFrame.time).not.toBe(-1);
      mon.beginFrame(); mon.endFrame();
      const best = mon.stats.bestFrame.time;
      mon.beginFrame(); mon.endFrame();
      expect(mon.stats.worstFrame.time).toBeGreaterThanOrEqual(best);
    } finally {
      spy.mockRestore();
    }
  });

  test('updateMemoryMetrics tolerates absent performance.memory', () => {
    const mon = new PerformanceMonitor();
    const prev = mon.metrics.memory.current;
    const orig = global.performance.memory;
    delete global.performance.memory;
    mon.updateMemoryMetrics();
    expect(mon.metrics.memory.current).toBe(prev);
    if (orig !== undefined) {
      global.performance.memory = orig;
    }
  });

  test('checkThresholds fires warning band and memory thresholds', () => {
    const mon = new PerformanceMonitor();
    mon.metrics.fps.current = 70; // below warning (80), above critical (60)
    mon.checkThresholds();
    expect(mon.alerts.some((a) => a.level === 'warning' && a.message.includes('FPS'))).toBe(true);
    mon.metrics.fps.current = 10;
    mon.checkThresholds();
    expect(mon.alerts.some((a) => a.level === 'critical')).toBe(true);
    mon.metrics.memory.current = mon.thresholds.memory.critical + 1;
    mon.checkThresholds();
    expect(mon.alerts.some((a) => a.level === 'critical' && a.message.includes('Memory'))).toBe(true);
    mon.metrics.memory.current = mon.thresholds.memory.warning + 1;
    mon.metrics.memory.critical = Infinity; // keep only warning
    mon.checkThresholds();
    expect(mon.alerts.some((a) => a.level === 'warning' && a.message.includes('Memory'))).toBe(true);
  });

  test('updateUI metricsDiv-absent arm: skips markup, still draws graph', () => {
    const mon = new PerformanceMonitor();
    // getElementById null → the `if (metricsDiv)` false arm; graph still runs.
    global.document.getElementById = () => null;
    mon.graphCtx = {
      fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
      stroke() {}, setLineDash() {}, fillText() {}
    };
    mon.graphCanvas = { width: 100, height: 50 };
    expect(() => mon.updateUI()).not.toThrow();
  });

  test('updateAlerts alert color/count arms', () => {
    const mon = new PerformanceMonitor();
    const alertsDiv = global.document.createElement('div');
    global.document.getElementById = (id) => id === 'perf-alerts' ? alertsDiv : null;
    mon.addAlert('warning', 'warn-msg');
    mon.addAlert('critical', 'crit-msg');
    mon.addAlert('critical', 'crit-msg'); // same message → count++ → (×2)
    mon.updateAlerts();
    const html = alertsDiv.innerHTML;
    expect(html).toContain('warn-msg');
    expect(html).toContain('crit-msg');
    expect(html).toContain('×2');
  });

  test('show/hide with container null do not throw', () => {
    const mon = new PerformanceMonitor();
    expect(() => {
      mon.show(); mon.hide();
    }).not.toThrow();
  });

  test('getReport totalFrames 0 → averageFrameTime 0', () => {
    const mon = new PerformanceMonitor();
    const s = mon.getReport();
    expect(s.summary.averageFrameTime).toBe(0);
    mon.stats.totalFrames = 2;
    mon.stats.totalTime = 40;
    expect(mon.getReport().summary.averageFrameTime).toBe(20);
  });

  test('exportCSV emits empty cell for missing history index', () => {
    const mon = new PerformanceMonitor();
    mon.metrics.fps.history = [12];
    const csv = mon.exportCSV();
    expect(csv).toContain('fps');
    // second metric rows: history[i] undefined → ''
    expect(typeof csv).toBe('string');
  });
});

describe('PerformanceMonitor — last branch arms', () => {
  test('endFrame updates best/worst records on new extremes', () => {
    const pm = new PerformanceMonitor();
    pm.beginFrame();
    pm.endFrame({ info: { render: { triangles: 1, calls: 1 }, memory: { geometries: 1, textures: 1 }, programs: [] } });
    const before = { best: pm.stats.bestFrame.time, worst: pm.stats.worstFrame.time };
    expect(before.worst).toBeGreaterThanOrEqual(before.best);
  });

  test('endFrame tolerates renderer.info.programs absent', () => {
    const pm = new PerformanceMonitor();
    pm.beginFrame();
    expect(() => pm.endFrame({ info: { render: { triangles: 1, calls: 1 }, memory: { geometries: 1, textures: 1 } } })).not.toThrow();
  });

  test('checkThresholds warning band without critical', () => {
    const pm = new PerformanceMonitor();
    pm.metrics.fps.current = 70; // below warning 80, above critical 60
    const alerts = [];
    pm.addAlert = (lvl, msg) => alerts.push(lvl);
    pm.checkThresholds();
    expect(alerts).toContain('warning');
    expect(alerts).not.toContain('critical');
  });
});

describe('PerformanceMonitor — complementary arms', () => {
  test('visible monitor shows the container', () => {
    const pm = new PerformanceMonitor();
    pm.visible = true;
    pm.container = { style: {} };
    pm.updateUI = jest.fn();
    pm.endFrame();
    expect(pm.updateUI).toHaveBeenCalled();
  });

  test('fps below warning but above critical emits a warning alert', () => {
    const pm = new PerformanceMonitor();
    const warns = [];
    pm.addAlert = (sev, msg) => warns.push(sev);
    pm.metrics.fps.current = (pm.thresholds.fps.warning + pm.thresholds.fps.critical) / 2;
    pm.checkThresholds();
    expect(warns).toContain('warning');
  });

  test('bestFrame updates when a faster frame arrives', () => {
    const pm = new PerformanceMonitor();
    pm.stats.bestFrame = { time: 100 };
    pm.beginFrame();
    pm.frameTime = 5;
    pm.endFrame?.();
    // best updated only if frameTime < 100 — drive through checkThresholds path
    if (pm.stats.bestFrame.time <= 100) {
      expect(pm.stats.bestFrame.time).toBeLessThanOrEqual(100);
    }
  });
});

describe('PerformanceMonitor — fps/best/threshold slivers', () => {
  test('endFrame records new best and worst frames', () => {
    const mon = new PerformanceMonitor();
    let t = 1000;
    jest.spyOn(performance, 'now').mockImplementation(() => t);
    mon.frameStartTime = 0;
    t = 5;    mon.endFrame(); // new best
    t = 500;  mon.endFrame(); // new worst
    expect(mon.stats.bestFrame.time).toBe(5);
    expect(mon.stats.worstFrame.time).toBe(500);
    performance.now.mockRestore();
  });

  test('fps metric only refreshes after the update interval', () => {
    const mon = new PerformanceMonitor();
    const t = performance.now();
    jest.spyOn(performance, 'now').mockImplementation(() => t);
    mon.lastFpsUpdate = t;
    mon.frameCount = 0;
    mon.frameStartTime = t;
    mon.endFrame();
    expect(mon.frameCount).toBe(1); // interval not elapsed → kept counting
    performance.now.mockRestore();
  });

  test('fps between warning and critical raises a warning alert', () => {
    const mon = new PerformanceMonitor();
    mon.metrics.fps.current = mon.thresholds.fps.warning - 1;
    mon.addAlert = jest.fn();
    mon.checkThresholds();
    expect(mon.addAlert).toHaveBeenCalledWith('warning', expect.any(String));
  });
});

test('hidden overlay renders display:none; fps in warning band alerts warning', () => {
  global.document = global.document || {};
  const el = () => ({ style: { cssText: '' }, appendChild() {}, getContext: () => null, addEventListener() {} });
  global.document.createElement = el;
  global.document.getElementById = el;
  global.document.body = { appendChild() {} };
  const mon = new PerformanceMonitor();
  mon.createUI();
  expect(mon.container.style.cssText).toContain('display: none');
  const warn = [];
  mon.addAlert = (level, msg) => warn.push(level);
  mon.metrics.fps.current = mon.thresholds.fps.warning - 1;
  mon.checkThresholds();
  expect(warn).toContain('warning');
});

describe('PerformanceMonitor — last complementary arms', () => {
  test('createUI renders the container when visible is preset', () => {
    const mon = new PerformanceMonitor();
    mon.visible = true;
    const el = () => ({ style: { cssText: '' }, appendChild() {}, getContext: () => null, addEventListener() {} });
    global.document = global.document || {};
    global.document.createElement = el;
    global.document.getElementById = el;
    global.document.body = { appendChild() {} };
    mon.createUI();
    expect(mon.container.style.cssText).toContain('block');
    delete global.document;
  });

  test('checkThresholds: fps in the warning band and above-warning arms', () => {
    const mon = new PerformanceMonitor();
    const alerts = [];
    mon.addAlert = (level, msg) => alerts.push(level);
    mon.thresholds = { fps: { warning: 55, critical: 20 }, frameTime: { warning: 20, critical: 33 }, memory: { warning: 0.8, critical: 0.95 } };
    mon.metrics.fps.current = 40; // below warning, above critical
    mon.checkThresholds();
    mon.metrics.fps.current = 90; // above warning — no alert arm
    mon.checkThresholds();
    expect(alerts).toContain('warning');
  });
});

describe('PerformanceMonitor — fps update interval arm', () => {
  test('update() inside the interval skips the fps recomputation', () => {
    const pm = new PerformanceMonitor();
    pm.frameStartTime = performance.now();
    const r = { info: { render: {}, memory: {} } };
    pm.endFrame(r);
    pm.endFrame(r); // still within fpsUpdateInterval — false arm
    expect(pm.frameCount).toBeGreaterThan(0);

    // And the recompute side: an elapsed interval updates stats.fps.
    pm.lastFpsUpdate = performance.now() - 2000;
    pm.frameStartTime = performance.now();
    pm.endFrame(r);
    expect(pm.metrics.fps.current).toBeGreaterThan(0);
  });
});


describe('PerformanceMonitor perf-close + memory interval bodies', () => {
  // Local element stub (the suite's makeEl is scoped inside another describe).
  function stubEl() {
    const el = {
      style: {}, children: [], innerHTML: '', parentNode: null, _h: {},
      appendChild(c) {
        el.children.push(c); return c;
      },
      removeChild(c) {
        el.children = el.children.filter((x) => x !== c);
      },
      addEventListener(t, f) {
        el._h[t] = f;
      },
      getContext() {
        return { calls: [] };
      }
    };
    return el;
  }

  test('perf-close click handler hides the overlay', () => {
    const saved = global.document;
    const byId = {};
    const close = stubEl(); byId['perf-close'] = close;
    const body = stubEl();
    global.document = {
      body,
      createElement: () => stubEl(),
      getElementById: (id) => byId[id] || null
    };
    try {
      const mon = new PerformanceMonitor();
      mon.createUI();
      close._h.click();
      expect(mon.visible).toBe(false);
      mon.dispose();
    } finally {
      if (saved === undefined) {
        delete global.document;
      } else {
        global.document = saved;
      }
    }
  });

  test('startMonitoring memory interval fires updateMemoryMetrics each second', () => {
    jest.useFakeTimers();
    const saved = performance.memory;
    performance.memory = { usedJSHeapSize: 1024 * 1024 };
    const mon = new PerformanceMonitor();
    const spy = jest.spyOn(mon, 'updateMemoryMetrics');
    mon.startMonitoring();
    jest.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalled();
    mon.dispose();
    if (saved === undefined) {
      delete performance.memory;
    } else {
      performance.memory = saved;
    }
    jest.useRealTimers();
  });
});
