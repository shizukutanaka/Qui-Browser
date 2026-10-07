/**
 * Round 957: PerformanceMonitor write-only stores
 *
 * Invariant: every field PerformanceMonitor stores must be read somewhere.
 * `this.enabled`, `this.lastFrameTime`, and the `this.stats` block
 * (totalFrames/totalTime/bestFrame/worstFrame/alertsGenerated) are written
 * and never read — the only consumer was the reporting surface removed in
 * #1161 (getReport/exportCSV/reset). Write-only diagnostics state.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MON = path.join(ROOT, 'src', 'utils', 'PerformanceMonitor.js');
const monSource = fs.readFileSync(MON, 'utf8');

const { PerformanceMonitor } = require('../src/utils/PerformanceMonitor.js');

describe('PerformanceMonitor write-only stores stay gone', () => {
  test('no write-only stores remain in the source', () => {
    for (const dead of ['this.enabled', 'this.lastFrameTime', 'this.stats']) {
      expect(monSource).not.toContain(dead);
    }
  });

  test('constructor does not allocate the dead stats object', () => {
    const mon = new PerformanceMonitor();
    expect(mon.stats).toBeUndefined();
    expect(mon.enabled).toBeUndefined();
    expect(mon.lastFrameTime).toBeUndefined();
  });

  test('live frame path still works without the dead stores', () => {
    const mon = new PerformanceMonitor();
    const renderer = {
      info: { render: { calls: 42, triangles: 1337 }, memory: { textures: 7 }, programs: [{}, {}] }
    };
    mon.beginFrame();
    expect(() => mon.endFrame(renderer)).not.toThrow();
    expect(mon.metrics.drawCalls.current).toBe(42);
    expect(mon.metrics.triangles.current).toBe(1337);
    expect(mon.metrics.textures.current).toBe(7);
    expect(mon.metrics.shaders.current).toBe(2);
  });
});
