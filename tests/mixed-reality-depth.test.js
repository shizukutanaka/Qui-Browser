/**
 * Unit tests for MixedReality mesh detection + depth sensing (FR-6.4).
 * THREE is mocked with minimal geometry/material/mesh stubs and IndexedDB is
 * left undefined so the persistence layer no-ops harmlessly.
 */

// ── THREE stub ────────────────────────────────────────────────────────────────
class MockBufferGeometry {
  constructor() { this._attrs = {}; this._index = null; }
  setAttribute(name, attr) { this._attrs[name] = attr; }
  setIndex(attr) { this._index = attr; }
  dispose() { this.disposed = true; }
}
class MockMaterial {
  constructor(opts = {}) { Object.assign(this, opts); }
  dispose() { this.disposed = true; }
}
class MockMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.name = '';
    this.children = [];
    this.position = { set: jest.fn() };
    this.quaternion = { set: jest.fn() };
  }
  add(o) { this.children.push(o); }
}

jest.mock('three', () => ({
  BufferGeometry: MockBufferGeometry,
  Float32BufferAttribute: class { constructor(a, n) { this.array = a; this.itemSize = n; } },
  Uint32BufferAttribute: class { constructor(a, n) { this.array = a; this.itemSize = n; } },
  MeshBasicMaterial: MockMaterial,
  LineBasicMaterial: MockMaterial,
  Mesh: MockMesh,
  EdgesGeometry: MockBufferGeometry,
  LineSegments: MockMesh,
  DirectionalLight: class { constructor() { this.position = { set: jest.fn() }; } },
  Color: class {},
  DoubleSide: 2
}));

const { MixedReality } = require('../src/vr/ar/MixedReality.js');

function makeScene() {
  const objs = [];
  return {
    _objs: objs,
    add: (o) => objs.push(o),
    remove: (o) => { const i = objs.indexOf(o); if (i !== -1) objs.splice(i, 1); },
    getObjectByName: () => null,
    background: null
  };
}

function makeMR() {
  return new MixedReality({ xr: {} }, makeScene());
}

global.window = global.window || {};

// A fake XRMesh.
function fakeMesh(label = 'wall') {
  return {
    vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    indices: new Uint32Array([0, 1, 2]),
    semanticLabel: label,
    meshSpace: {}
  };
}

describe('MixedReality mesh detection (FR-6.4)', () => {
  test('detects a new mesh and creates a visualizer', () => {
    const mr = makeMR();
    const mesh = fakeMesh();
    const frame = { detectedMeshes: new Set([mesh]) };

    mr.updateMeshes(frame);

    expect(mr.detectedMeshes.size).toBe(1);
    expect(mr.meshVisualizers.size).toBe(1);
    expect(mr.detectedMeshes.get(mesh).label).toBe('wall');
  });

  test('does not re-create a visualizer for an already-tracked mesh', () => {
    const mr = makeMR();
    const mesh = fakeMesh();
    const frame = { detectedMeshes: new Set([mesh]) };

    mr.updateMeshes(frame);
    mr.updateMeshes(frame);

    expect(mr.detectedMeshes.size).toBe(1);
    expect(mr.stats.meshesDetected).toBe(1);
  });

  test('removes a mesh that is no longer reported', () => {
    const mr = makeMR();
    const mesh = fakeMesh();

    mr.updateMeshes({ detectedMeshes: new Set([mesh]) });
    const visual = mr.meshVisualizers.get(mesh);
    mr.updateMeshes({ detectedMeshes: new Set() }); // gone

    expect(mr.detectedMeshes.size).toBe(0);
    expect(mr.meshVisualizers.size).toBe(0);
    expect(visual.geometry.disposed).toBe(true);
    expect(visual.material.disposed).toBe(true);
  });

  test('updateMeshes no-ops when frame has no detectedMeshes', () => {
    const mr = makeMR();
    expect(() => mr.updateMeshes({})).not.toThrow();
    expect(mr.detectedMeshes.size).toBe(0);
  });

  test('builds geometry with vertex positions and an index', () => {
    const mr = makeMR();
    const mesh = fakeMesh();
    mr.updateMeshes({ detectedMeshes: new Set([mesh]) });
    const visual = mr.meshVisualizers.get(mesh);
    expect(visual.geometry._attrs.position).toBeDefined();
    expect(visual.geometry._index).not.toBeNull();
  });
});

describe('MixedReality depth sensing (FR-6.4)', () => {
  function makeDepthFrame(depthValue) {
    return {
      getViewerPose: () => ({ views: [{ eye: 'left' }] }),
      getDepthInformation: () => ({
        width: 160, height: 90,
        getDepthInMeters: () => depthValue
      })
    };
  }

  test('captures the depth buffer when depth sensing is active', () => {
    const mr = makeMR();
    mr.referenceSpace = {};
    mr.updateDepth(makeDepthFrame(1.5));
    expect(mr.latestDepth).not.toBeNull();
    expect(mr.stats.depthFrames).toBe(1);
  });

  test('getDepthInMeters returns the sampled distance', () => {
    const mr = makeMR();
    mr.referenceSpace = {};
    mr.updateDepth(makeDepthFrame(2.25));
    expect(mr.getDepthInMeters(0.5, 0.5)).toBe(2.25);
  });

  test('getDepthInMeters returns null with no depth buffer', () => {
    const mr = makeMR();
    expect(mr.getDepthInMeters(0.5, 0.5)).toBeNull();
  });

  test('updateDepth no-ops when the frame lacks getDepthInformation', () => {
    const mr = makeMR();
    mr.referenceSpace = {};
    expect(() => mr.updateDepth({})).not.toThrow();
    expect(mr.latestDepth).toBeNull();
  });

  test('updateDepth no-ops without a reference space', () => {
    const mr = makeMR();
    mr.updateDepth(makeDepthFrame(1));
    expect(mr.latestDepth).toBeNull();
  });
});

describe('MixedReality FR-6.4 stats + teardown', () => {
  test('getStats reports mesh count and depth availability', () => {
    const mr = makeMR();
    mr.referenceSpace = {};
    mr.updateMeshes({ detectedMeshes: new Set([fakeMesh()]) });
    mr.updateDepth({
      getViewerPose: () => ({ views: [{}] }),
      getDepthInformation: () => ({ getDepthInMeters: () => 1 })
    });
    const stats = mr.getStats();
    expect(stats.meshesDetected).toBe(1);
    expect(stats.depthAvailable).toBe(true);
  });

  test('onSessionEnd clears meshes and depth', () => {
    const mr = makeMR();
    mr.referenceSpace = {};
    mr.updateMeshes({ detectedMeshes: new Set([fakeMesh()]) });
    mr.updateDepth({
      getViewerPose: () => ({ views: [{}] }),
      getDepthInformation: () => ({ getDepthInMeters: () => 1 })
    });
    mr.onSessionEnd();
    expect(mr.detectedMeshes.size).toBe(0);
    expect(mr.meshVisualizers.size).toBe(0);
    expect(mr.latestDepth).toBeNull();
  });
});

describe('MixedReality passthrough detection (checkSupport / hasPassthroughExtension)', () => {
  let origNavigatorXr, origOculusExt;

  beforeEach(() => {
    origNavigatorXr = navigator.xr;
    origOculusExt = global.window.OculusBrowserExt;
  });
  afterEach(() => {
    navigator.xr = origNavigatorXr;
    global.window.OculusBrowserExt = origOculusExt;
  });

  test('hasPassthroughExtension() is false with no vendor signal', () => {
    delete global.window.OculusBrowserExt;
    const mr = makeMR();
    expect(mr.hasPassthroughExtension()).toBe(false);
  });

  test('hasPassthroughExtension() is true only with the genuine Oculus/Meta vendor global', () => {
    global.window.OculusBrowserExt = {};
    const mr = makeMR();
    expect(mr.hasPassthroughExtension()).toBe(true);
  });

  test('hasPassthroughExtension() no longer false-positives on isSessionSupported merely existing', () => {
    // Regression guard: the previous implementation returned true whenever
    // navigator.xr.isSessionSupported existed as a method — true on virtually
    // any WebXR browser, VR-only headsets included — regardless of any real
    // camera-passthrough capability.
    delete global.window.OculusBrowserExt;
    navigator.xr = { isSessionSupported: jest.fn() };
    const mr = makeMR();
    expect(mr.hasPassthroughExtension()).toBe(false);
  });

  test('checkSupport() reports passthrough:true when immersive-ar is supported', async () => {
    navigator.xr = { isSessionSupported: jest.fn(() => Promise.resolve(true)) };
    delete global.window.OculusBrowserExt;
    const mr = makeMR();
    const support = await mr.checkSupport();
    expect(support.ar).toBe(true);
    expect(support.passthrough).toBe(true);
  });

  test('checkSupport() reports passthrough:false when neither immersive-ar nor a vendor signal is present', async () => {
    // The core regression: previously this was always true.
    navigator.xr = { isSessionSupported: jest.fn(() => Promise.resolve(false)) };
    delete global.window.OculusBrowserExt;
    const mr = makeMR();
    const support = await mr.checkSupport();
    expect(support.ar).toBe(false);
    expect(support.passthrough).toBe(false);
  });

  test('checkSupport() falls back to the vendor signal when immersive-ar is unsupported', async () => {
    navigator.xr = { isSessionSupported: jest.fn(() => Promise.resolve(false)) };
    global.window.OculusBrowserExt = {};
    const mr = makeMR();
    const support = await mr.checkSupport();
    expect(support.ar).toBe(false);
    expect(support.passthrough).toBe(true);
  });
});

describe('MixedReality.setPassthroughOpacity (was a no-op branch)', () => {
  test('clamps and stores the value on settings.passthroughOpacity', () => {
    const mr = makeMR();
    mr.setPassthroughOpacity(0.5);
    expect(mr.settings.passthroughOpacity).toBe(0.5);
  });

  test('clamps above 1 down to 1', () => {
    const mr = makeMR();
    mr.setPassthroughOpacity(5);
    expect(mr.settings.passthroughOpacity).toBe(1);
  });

  test('clamps below 0 up to 0', () => {
    const mr = makeMR();
    mr.setPassthroughOpacity(-2);
    expect(mr.settings.passthroughOpacity).toBe(0);
  });

  test('does not throw regardless of scene.background', () => {
    const mr = makeMR();
    mr.scene.background = null;
    expect(() => mr.setPassthroughOpacity(0.3)).not.toThrow();
  });
});
