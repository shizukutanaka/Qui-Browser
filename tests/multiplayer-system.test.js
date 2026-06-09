/**
 * Unit tests for MultiplayerSystem peer lifecycle & resilience.
 * Focuses on the previously-missing handlePeerLeft() path and malformed-message
 * handling. THREE is mocked; WebRTC/WebSocket are simulated via stub objects
 * inserted into the internal maps.
 */

class MockGeometry { dispose() { this.disposed = true; } }
class MockMaterial { dispose() { this.disposed = true; } }
class MockObj {
  constructor() { this.children = []; this.position = { set: jest.fn(), x: 0, y: 0, z: 0 }; this.name = ''; }
  add(o) { this.children.push(o); }
  traverse(fn) { fn(this); this.children.forEach(c => (c.traverse ? c.traverse(fn) : fn(c))); }
}
class MockMesh extends MockObj {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
}

jest.mock('three', () => ({
  Group: MockObj,
  Mesh: MockMesh,
  CapsuleGeometry: MockGeometry,
  SphereGeometry: MockGeometry,
  MeshPhongMaterial: MockMaterial,
  Vector3: class { constructor() { this.set = () => {}; } },
  Quaternion: class {}
}));

const { MultiplayerSystem } = require('../src/vr/multiplayer/MultiplayerSystem.js');

function makeScene() {
  const objs = [];
  return { _objs: objs, add: (o) => objs.push(o), remove: (o) => {
    const i = objs.indexOf(o); if (i !== -1) objs.splice(i, 1);
  } };
}

function makeSystem(spatialAudio = null) {
  return new MultiplayerSystem(makeScene(), spatialAudio);
}

describe('MultiplayerSystem peer lifecycle', () => {
  test('handlePeerLeft is defined (was previously missing)', () => {
    const mp = makeSystem();
    expect(typeof mp.handlePeerLeft).toBe('function');
  });

  test('handleSignaling("peer-left") does not throw', () => {
    const mp = makeSystem();
    return expect(mp.handleSignaling({ type: 'peer-left', peerId: 'ghost' }))
      .resolves.toBeUndefined();
  });

  test('handlePeerLeft closes the connection and decrements connectedPeers', () => {
    const mp = makeSystem();
    const close = jest.fn();
    mp.peers.set('p1', { close });
    mp.stats.connectedPeers = 1;

    mp.handlePeerLeft('p1');

    expect(close).toHaveBeenCalled();
    expect(mp.peers.has('p1')).toBe(false);
    expect(mp.stats.connectedPeers).toBe(0);
  });

  test('handlePeerLeft closes and drops the data channel', () => {
    const mp = makeSystem();
    const close = jest.fn();
    mp.dataChannels.set('p1', { close });
    mp.handlePeerLeft('p1');
    expect(close).toHaveBeenCalled();
    expect(mp.dataChannels.has('p1')).toBe(false);
  });

  test('handlePeerLeft removes and disposes the avatar', () => {
    const mp = makeSystem();
    mp.createAvatar('p1', { color: 0x00ff00 });
    expect(mp.avatars.has('p1')).toBe(true);
    const group = mp.avatars.get('p1').group;

    mp.handlePeerLeft('p1');

    expect(mp.avatars.has('p1')).toBe(false);
    expect(mp.scene._objs).not.toContain(group);
  });

  test('handlePeerLeft releases the spatial voice source', () => {
    const audio = { removeVoiceSource: jest.fn() };
    const mp = makeSystem(audio);
    mp.handlePeerLeft('p1');
    expect(audio.removeVoiceSource).toHaveBeenCalledWith('p1');
  });

  test('connectedPeers never goes negative', () => {
    const mp = makeSystem();
    mp.peers.set('p1', { close: jest.fn() });
    mp.stats.connectedPeers = 0; // already zero
    mp.handlePeerLeft('p1');
    expect(mp.stats.connectedPeers).toBe(0);
  });

  test('updateIntervals is initialised so disconnect() is safe before setup', () => {
    const mp = makeSystem();
    expect(Array.isArray(mp.updateIntervals)).toBe(true);
    expect(() => mp.disconnect()).not.toThrow();
  });

  test('disconnect disposes all avatars', () => {
    const mp = makeSystem();
    mp.createAvatar('a', {});
    mp.createAvatar('b', {});
    const groups = [...mp.avatars.values()].map(a => a.group);
    mp.disconnect();
    expect(mp.avatars.size).toBe(0);
    // every geometry under each avatar was disposed
    expect(groups.every(g => g.children.every(c => !c.geometry || c.geometry.disposed))).toBe(true);
  });
});
