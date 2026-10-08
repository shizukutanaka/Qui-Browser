jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({
  VRButton: {
    createButton: jest.fn(() => ({ addEventListener: jest.fn(), removeEventListener: jest.fn(), parentNode: null }))
  }
}));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: jest.fn(() => ({ createControllerModel: jest.fn() }))
}));

const fs = require('fs');
const path = require('path');
const { VRApp } = require('../src/vr/VRApp.js');

const VRAPP_SRC = fs.readFileSync(path.join(__dirname, '../src/vr/VRApp.js'), 'utf8');

// Minimal stub `this` for binding VRApp.prototype methods (a real `new
// VRApp()` needs a GPU context — out of scope for jest per CLAUDE.md).
function makeApp() {
  return {
    frameCount: 0,
    _qualityClock: 0,
    settings: { targetFPS: 90 },
    performanceMonitor: { frameTime: 16.67, fps: 60 },
    renderer: { render: jest.fn(), info: { render: { calls: 0, triangles: 0 } } },
    scene: {},
    camera: {},
    updateSystems: jest.fn(),
    updatePerformanceMonitor: jest.fn(),
    adjustQuality: jest.fn(),
    _runPerFrame: (label, fn) => fn(),
    _lastRenderTime: null
  };
}

describe('round 993 — performance-monitor Hz coupling', () => {
  test('frame-time EMA is normalised by real dt — same elapsed time converges identically at 60 Hz and 120 Hz', () => {
    const a = makeApp();
    const b = makeApp();
    // One 60 fps frame covering T vs two 120 fps frames covering the same T.
    // Each sample is the measured frame duration for that frame — feeding the
    // same sample value isolates the smoothing constant from the input.
    VRApp.prototype.updatePerformanceMonitor.call(a, 20, 1 / 60);
    VRApp.prototype.updatePerformanceMonitor.call(b, 20, 1 / 120);
    VRApp.prototype.updatePerformanceMonitor.call(b, 20, 1 / 120);
    expect(b.performanceMonitor.frameTime).toBeCloseTo(a.performanceMonitor.frameTime, 6);
  });

  test('frame-time EMA preserves the authored 60 fps weight (0.9 old / 0.1 new) at dt = 1/60', () => {
    const a = makeApp();
    a.performanceMonitor.frameTime = 10;
    VRApp.prototype.updatePerformanceMonitor.call(a, 20, 1 / 60);
    expect(a.performanceMonitor.frameTime).toBeCloseTo(10 * 0.9 + 20 * 0.1, 6);
  });

  test('quality evaluation cadence is time-based, not a bare frame count', () => {
    expect(VRAPP_SRC).not.toMatch(/frameCount\s*%\s*60/);
    expect(VRAPP_SRC).toMatch(/_qualityClock/);
  });

  test('adjustQuality fires at the authored ~1 s cadence at 120 Hz, not 2× as often', () => {
    const nowSpy = jest.spyOn(performance, 'now');
    try {
      let t = 1000;
      // render() calls performance.now() once per frame for dt, then once
      // more for frameTime — but the second call goes to the stubbed
      // updatePerformanceMonitor? No: render() itself calls it twice.
      nowSpy.mockImplementation(() => t);

      const runFrames = (app, count, dtMs) => {
        for (let i = 0; i < count; i += 1) {
          t += dtMs;
          VRApp.prototype.render.call(app, t, null);
        }
      };

      const a = makeApp();
      runFrames(a, 61, 1000 / 60); // ~1 s at 60 Hz
      expect(a.adjustQuality).toHaveBeenCalledTimes(1);

      const b = makeApp();
      runFrames(b, 121, 1000 / 120); // ~1 s at 120 Hz — same wall time
      expect(b.adjustQuality).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
