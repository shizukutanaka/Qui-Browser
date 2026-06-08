/**
 * Unit tests for AvatarSystem (FR-7.2).
 * THREE is mocked with minimal stubs so the pure lifecycle logic can be
 * exercised without a real WebGL context.
 */

// ── THREE stub ────────────────────────────────────────────────────────────────
class MockGeometry {
  dispose() {}
}
class MockMaterial {
  dispose() {}
}
class MockMesh {
  constructor() {
    this.name = '';
    this.position = { x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1, set: jest.fn() };
    this.children = [];
  }
}
class MockGroup {
  constructor() {
    this.name = '';
    this.position = { x: 0, y: 0, z: 0, set: jest.fn() };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1, set: jest.fn() };
    this.children = [];
    this._objects = [];
  }
  add(obj) { this._objects.push(obj); }
  remove(obj) { this._objects = this._objects.filter(o => o !== obj); }
  traverse(fn) { this._objects.forEach(fn); fn(this); }
  getObjectByName() { return null; }
  worldToLocal(v) { return v; }
}
class MockSprite {
  constructor() {
    this.name = '';
    this.scale = { set: jest.fn() };
    this.position = { set: jest.fn() };
  }
}
class MockScene {
  constructor() { this._objects = []; }
  add(obj) { this._objects.push(obj); }
  remove(obj) { this._objects = this._objects.filter(o => o !== obj); }
}

// Inject THREE mock before requiring the module.
jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  Sprite: MockSprite,
  SphereGeometry: MockGeometry,
  MeshStandardMaterial: MockMaterial,
  SpriteMaterial: MockMaterial,
  CanvasTexture: class { dispose() {} },
  Vector3: class {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    copy() {}
  }
}));

// Stub document.createElement for canvas
global.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      roundRect: jest.fn(),
      fill: jest.fn(),
      fillText: jest.fn()
    })
  })
};

const { AvatarSystem } = require('../src/vr/multiplayer/AvatarSystem.js');

describe('AvatarSystem (FR-7.2)', () => {
  let scene;
  let sys;

  beforeEach(() => {
    scene = new MockScene();
    sys = new AvatarSystem(scene);
  });

  test('starts with no peers', () => {
    expect(sys.getPeerIds()).toHaveLength(0);
  });

  test('addPeer() creates an avatar in the scene', () => {
    sys.addPeer('peer1', 'Alice');
    expect(sys.getPeerIds()).toContain('peer1');
    expect(scene._objects).toHaveLength(1);
  });

  test('addPeer() is idempotent for the same peer ID', () => {
    sys.addPeer('peer1', 'Alice');
    sys.addPeer('peer1', 'Alice Updated');
    expect(sys.getPeerIds()).toHaveLength(1);
  });

  test('removePeer() removes the avatar from the scene', () => {
    sys.addPeer('peer1', 'Alice');
    sys.removePeer('peer1');
    expect(sys.getPeerIds()).toHaveLength(0);
    expect(scene._objects).toHaveLength(0);
  });

  test('removePeer() is safe for unknown peer ID', () => {
    expect(() => sys.removePeer('nobody')).not.toThrow();
  });

  test('updatePeerPose() applies head position without throwing', () => {
    sys.addPeer('peer1');
    expect(() => sys.updatePeerPose('peer1', {
      head: {
        position: { x: 1, y: 1.7, z: -2 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 }
      }
    })).not.toThrow();
  });

  test('updatePeerPose() is safe for unknown peer ID', () => {
    expect(() => sys.updatePeerPose('ghost', {})).not.toThrow();
  });

  test('dispose() removes all avatars', () => {
    sys.addPeer('a');
    sys.addPeer('b');
    sys.dispose();
    expect(sys.getPeerIds()).toHaveLength(0);
    expect(scene._objects).toHaveLength(0);
  });
});
