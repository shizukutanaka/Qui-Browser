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
    for (let i = 0; i < 12; i++) mon.addAlert('warning', `w${i}-${Math.random()}`);
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
      appendChild(c) { c.parentNode = el; el.children.push(c); },
      removeChild(c) { el.children = el.children.filter(x => x !== c); c.parentNode = null; },
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
      get() { return this._id; },
      set(v) { this._id = v; byId[v] = el; }
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
