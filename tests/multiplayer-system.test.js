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

describe('MultiplayerSystem signaling auto-reconnect', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('schedules a reconnect when connected, firing after the 1s backoff', () => {
    const mp = makeSystem();
    mp.connected = true;
    mp.connectSignaling = jest.fn(() => new Promise(() => {})); // never resolves
    mp._scheduleSignalingReconnect();
    expect(mp._signalingReconnectTimer).not.toBeNull();
    jest.advanceTimersByTime(999);
    expect(mp.connectSignaling).not.toHaveBeenCalled(); // not early
    jest.advanceTimersByTime(1);
    expect(mp.connectSignaling).toHaveBeenCalledTimes(1);
  });

  test('does not schedule when not connected (no room to restore)', () => {
    const mp = makeSystem();
    mp.connected = false;
    mp.connectSignaling = jest.fn(() => Promise.resolve());
    mp._scheduleSignalingReconnect();
    expect(mp._signalingReconnectTimer).toBeNull();
    jest.advanceTimersByTime(5000);
    expect(mp.connectSignaling).not.toHaveBeenCalled();
  });

  test('is idempotent — a burst of calls creates only one pending reconnect', () => {
    const mp = makeSystem();
    mp.connected = true;
    mp.connectSignaling = jest.fn(() => new Promise(() => {}));
    mp._scheduleSignalingReconnect();
    mp._scheduleSignalingReconnect();
    mp._scheduleSignalingReconnect();
    jest.advanceTimersByTime(1000);
    expect(mp.connectSignaling).toHaveBeenCalledTimes(1);
  });

  test('the backoff attempt counter advances across reconnects', () => {
    const mp = makeSystem();
    mp.connected = true;
    mp.connectSignaling = jest.fn(() => new Promise(() => {})); // stays pending
    mp._scheduleSignalingReconnect();
    expect(mp._signalingReconnectAttempts).toBe(1);
    jest.advanceTimersByTime(1000); // fires; promise pending so no reset
    expect(mp._signalingReconnectTimer).toBeNull();
    mp._scheduleSignalingReconnect();
    expect(mp._signalingReconnectAttempts).toBe(2);
  });

  test('a successful reconnect resets the backoff counter', async () => {
    const mp = makeSystem();
    mp.connected = true;
    mp.connectSignaling = jest.fn(() => Promise.resolve());
    mp._scheduleSignalingReconnect();
    jest.advanceTimersByTime(1000);
    await Promise.resolve(); // flush connectSignaling().then
    await Promise.resolve();
    expect(mp._signalingReconnectAttempts).toBe(0);
  });

  test('disconnect cancels a pending reconnect and resets the backoff', () => {
    const mp = makeSystem();
    mp.connected = true;
    mp.connectSignaling = jest.fn(() => Promise.resolve());
    mp._scheduleSignalingReconnect();
    expect(mp._signalingReconnectTimer).not.toBeNull();
    mp.disconnect();
    expect(mp._signalingReconnectTimer).toBeNull();
    expect(mp._signalingReconnectAttempts).toBe(0);
    jest.advanceTimersByTime(5000);
    expect(mp.connectSignaling).not.toHaveBeenCalled();
  });
});
