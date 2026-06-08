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
