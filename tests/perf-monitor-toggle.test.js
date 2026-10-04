/**
 * The 'P' shortcut is the only user-facing entry to the performance
 * dashboard. VRApp.togglePerfMonitor() lazily constructs the rich
 * PerformanceMonitor on first press and toggles it thereafter, so the
 * overlay is reachable without a boot-time setting flag.
 */

// Real 'three' (same convention as vr-app-wiring.test.js) — only the two
// WebXR-session-touching examples modules VRApp imports are mocked, since
// their top-level code assumes a real navigator.xr.
jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({
  VRButton: { createButton: () => ({}) }
}));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: class {
    createControllerModel() {
      return {};
    }
  }
}));

import { VRApp } from '../src/vr/VRApp.js';
import { PerformanceMonitor } from '../src/utils/PerformanceMonitor.js';

// Class stub (not jest.fn) — resetMocks:true would clear a jest.fn
// implementation between tests. Calls are counted by hand.
jest.mock('../src/utils/PerformanceMonitor.js', () => {
  class MockPerformanceMonitor {
    constructor() {
      this.visible = false;
      this.initializeCalls = 0;
      this.toggleCalls = 0;
      MockPerformanceMonitor.instances.push(this);
    }

    initialize() {
      this.initializeCalls++;
    }

    toggle() {
      this.toggleCalls++;
      this.visible = !this.visible;
    }

    static reset() {
      MockPerformanceMonitor.instances = [];
    }
  }
  MockPerformanceMonitor.instances = [];
  return { PerformanceMonitor: MockPerformanceMonitor };
});

describe('VRApp.togglePerfMonitor', () => {
  const stub = () => {
    const app = Object.create(VRApp.prototype);
    app.perfMonitorUI = null;
    return app;
  };

  beforeEach(() => {
    PerformanceMonitor.reset();
  });

  test('first call lazily constructs and shows the dashboard', () => {
    const app = stub();
    const visible = VRApp.prototype.togglePerfMonitor.call(app);
    expect(PerformanceMonitor.instances).toHaveLength(1);
    const inst = PerformanceMonitor.instances[0];
    expect(inst.initializeCalls).toBe(1);
    expect(inst.toggleCalls).toBe(1);
    expect(app.perfMonitorUI).toBe(inst);
    expect(visible).toBe(true);
  });

  test('second call toggles the same instance back off (no rebuild)', () => {
    const app = stub();
    VRApp.prototype.togglePerfMonitor.call(app);
    const visible = VRApp.prototype.togglePerfMonitor.call(app);
    expect(PerformanceMonitor.instances).toHaveLength(1);
    const inst = PerformanceMonitor.instances[0];
    expect(inst.initializeCalls).toBe(1);
    expect(inst.toggleCalls).toBe(2);
    expect(visible).toBe(false);
  });

  test('a pre-constructed monitor toggles without reinitializing', () => {
    const app = stub();
    const inst = new PerformanceMonitor();
    app.perfMonitorUI = inst;
    const visible = VRApp.prototype.togglePerfMonitor.call(app);
    expect(PerformanceMonitor.instances).toHaveLength(1);
    expect(inst.initializeCalls).toBe(0);
    expect(inst.toggleCalls).toBe(1);
    expect(visible).toBe(true);
  });
});
