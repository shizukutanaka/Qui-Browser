/**
 * Unit tests for MultiplayerSystem peer lifecycle & resilience.
 * Focuses on the previously-missing handlePeerLeft() path and malformed-message
 * handling. THREE is mocked; WebRTC/WebSocket are simulated via stub objects
 * inserted into the internal maps.
 */

class MockGeometry { dispose() { this.disposed = true; } }
class MockMaterial { constructor(o = {}) { Object.assign(this, o); } dispose() { this.disposed = true; } }
class MockObj {
  constructor() { this.children = []; this.position = { set: jest.fn(), x: 0, y: 0, z: 0 }; this.name = ''; }
  add(o) { this.children.push(o); }
  traverse(fn) { fn(this); this.children.forEach(c => (c.traverse ? c.traverse(fn) : fn(c))); }
}
class MockMesh extends MockObj {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
}
class MockSprite extends MockObj {
  constructor(material) { super(); this.material = material; this.scale = { set: jest.fn() }; }
}
class MockCanvasTexture { dispose() { this.disposed = true; } }

jest.mock('three', () => ({
  Group: MockObj,
  Mesh: MockMesh,
  Sprite: MockSprite,
  SpriteMaterial: MockMaterial,
  CanvasTexture: MockCanvasTexture,
  CapsuleGeometry: MockGeometry,
  SphereGeometry: MockGeometry,
  MeshPhongMaterial: MockMaterial,
  Vector3: class { constructor() { this.set = () => {}; } },
  Quaternion: class {}
}));

// ── canvas/document stub (name-label rendering) ───────────────────────────────
global.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      fillRect: jest.fn(), fillText: jest.fn(),
      set fillStyle(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {}
    })
  })
};

const {
  MultiplayerSystem,
  canSendOnChannel,
  MAX_BUFFERED_BYTES,
  MAX_PEER_RECONNECT_ATTEMPTS
} = require('../src/vr/multiplayer/MultiplayerSystem.js');

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

describe('MultiplayerSystem._detachPeerHandlers (stale-callback race fix)', () => {
  test('nulls all peer connection handlers', () => {
    const mp = makeSystem();
    const pc = { onicecandidate: () => {}, onconnectionstatechange: () => {}, ondatachannel: () => {} };
    mp._detachPeerHandlers(pc, null);
    expect(pc.onicecandidate).toBeNull();
    expect(pc.onconnectionstatechange).toBeNull();
    expect(pc.ondatachannel).toBeNull();
  });

  test('nulls all data channel handlers', () => {
    const mp = makeSystem();
    const channel = { onopen: () => {}, onmessage: () => {}, onerror: () => {}, onclose: () => {} };
    mp._detachPeerHandlers(null, channel);
    expect(channel.onopen).toBeNull();
    expect(channel.onmessage).toBeNull();
    expect(channel.onerror).toBeNull();
    expect(channel.onclose).toBeNull();
  });

  test('is null-safe when both pc and channel are missing', () => {
    const mp = makeSystem();
    expect(() => mp._detachPeerHandlers(null, null)).not.toThrow();
  });

  // RTCDataChannel/RTCPeerConnection dispatch close/statechange events
  // asynchronously — a stale onclose from an old, already-closed channel can
  // fire *after* a new channel for the same peerId has already been
  // registered (reconnectPeer, a flapping connection, and disconnect() can
  // all recreate a peer's channel under the same key). Without detaching the
  // old handlers first, that late onclose would call
  // this.dataChannels.delete(peerId) and silently wipe out the new, live
  // channel's map entry.
  test('handlePeerLeft: a stale onclose from the old channel cannot delete a since-reconnected channel', () => {
    const mp = makeSystem();
    const oldChannel = { close: jest.fn() };
    mp.dataChannels.set('p1', oldChannel);
    mp.peers.set('p1', { close: jest.fn() });

    mp.handlePeerLeft('p1');
    expect(oldChannel.onclose).toBeNull();

    // A brand-new channel reconnects under the same peerId, as
    // setupDataChannel's onopen would register it.
    const newChannel = { close: jest.fn() };
    mp.dataChannels.set('p1', newChannel);

    // The old channel's close event finally arrives late. Pre-fix this would
    // still be the real handler and would delete the new entry; post-fix
    // onclose is null so nothing runs.
    if (oldChannel.onclose) {
      oldChannel.onclose();
    }
    expect(mp.dataChannels.get('p1')).toBe(newChannel);
  });

  test('reconnectPeer: a stale onclose from the old channel cannot delete a since-reconnected channel', () => {
    const mp = makeSystem();
    mp.handlePeerJoined = jest.fn().mockResolvedValue(); // stub real renegotiation
    const oldChannel = { close: jest.fn() };
    mp.dataChannels.set('p1', oldChannel);
    mp.peers.set('p1', { close: jest.fn() });

    mp.reconnectPeer('p1');
    expect(oldChannel.onclose).toBeNull();

    const newChannel = { close: jest.fn() };
    mp.dataChannels.set('p1', newChannel);

    if (oldChannel.onclose) {
      oldChannel.onclose();
    }
    expect(mp.dataChannels.get('p1')).toBe(newChannel);
  });

  test('disconnect() detaches handlers and explicitly closes every data channel', () => {
    const mp = makeSystem();
    const pc = { close: jest.fn(), onconnectionstatechange: () => {}, ondatachannel: () => {}, onicecandidate: () => {} };
    const dc = { close: jest.fn(), onopen: () => {}, onmessage: () => {}, onerror: () => {}, onclose: () => {} };
    mp.peers.set('p1', pc);
    mp.dataChannels.set('p1', dc);

    mp.disconnect();

    expect(pc.onconnectionstatechange).toBeNull();
    expect(dc.onclose).toBeNull();
    expect(dc.close).toHaveBeenCalled();
  });
});

describe('MultiplayerSystem.updatePlayerInfo (was previously undefined — real bug)', () => {
  // handleDataMessage's 'player-info' case calls this.updatePlayerInfo(peerId,
  // data), sent immediately when a data channel opens. The method did not
  // exist at all, so every real peer connection threw a TypeError on the very
  // first message, and — since nothing else in the live message flow ever
  // called createAvatar() — no remote peer's avatar was ever created. Avatar
  // position/rotation/hand-pose sync all early-return on a missing entry in
  // this.avatars, so the whole feature was non-functional despite being
  // fully implemented and covered by tests that call createAvatar() directly.

  test('is defined (regression guard for the missing-method bug)', () => {
    const mp = makeSystem();
    expect(typeof mp.updatePlayerInfo).toBe('function');
  });

  test('creates the avatar on first contact', () => {
    const mp = makeSystem();
    expect(mp.avatars.has('p1')).toBe(false);

    mp.updatePlayerInfo('p1', { name: 'Alice', color: 0x00ff00 });

    expect(mp.avatars.has('p1')).toBe(true);
    expect(mp.avatars.get('p1').info.name).toBe('Alice');
  });

  test('mirrors exactly what handleDataMessage does for a real "player-info" message', () => {
    const mp = makeSystem();
    expect(() => mp.handleDataMessage('p1', { type: 'player-info', data: { name: 'Bob' } }))
      .not.toThrow();
    expect(mp.avatars.has('p1')).toBe(true);
  });

  test('does not recreate an existing avatar, but refreshes its info', () => {
    const mp = makeSystem();
    mp.createAvatar('p1', { name: 'Old Name' });
    const group = mp.avatars.get('p1').group;

    mp.updatePlayerInfo('p1', { name: 'New Name' });

    expect(mp.avatars.get('p1').group).toBe(group); // same avatar, not recreated
    expect(mp.avatars.get('p1').info.name).toBe('New Name');
  });

  test('does not throw when info is missing/undefined', () => {
    const mp = makeSystem();
    expect(() => mp.updatePlayerInfo('p1', undefined)).not.toThrow();
    expect(mp.avatars.has('p1')).toBe(false);
  });
});

describe('MultiplayerSystem avatar name label (was previously a stub)', () => {
  test('createAvatar() attaches a name-label sprite to the group', () => {
    const mp = makeSystem();
    mp.createAvatar('p1', { name: 'Alice' });
    const avatar = mp.avatars.get('p1');
    expect(avatar.nameLabel).toBeTruthy();
    expect(avatar.group.children).toContain(avatar.nameLabel);
  });

  test('falls back to the peer id when no name is provided', () => {
    const mp = makeSystem();
    expect(() => mp.createAvatar('p1', {})).not.toThrow();
  });

  test('_disposeAvatar() also disposes the name label\'s texture (map), not just the material', () => {
    // The SpriteMaterial owns a CanvasTexture (map); disposing the material
    // alone does not free the GPU texture memory — same leak class already
    // fixed for WebPanel/TabManager/BookmarkPanel.
    const mp = makeSystem();
    mp.createAvatar('p1', { name: 'Alice' });
    const { nameLabel } = mp.avatars.get('p1');
    const texture = nameLabel.material.map;
    expect(texture).toBeTruthy();

    mp.handlePeerLeft('p1');

    expect(nameLabel.material.disposed).toBe(true);
    expect(texture.disposed).toBe(true);
  });
});

describe('MultiplayerSystem WebRTC peer-reconnect cap (ghost-avatar prevention)', () => {
  function makeFailedPc() {
    return { connectionState: 'failed', close: jest.fn() };
  }

  test('a failed connection attempts reconnect before the cap is reached', () => {
    const mp = makeSystem();
    mp.reconnectPeer = jest.fn();
    mp.handlePeerLeft = jest.fn();
    const pc = makeFailedPc();
    mp.setupPeerConnection(pc, 'p1');

    pc.onconnectionstatechange();

    expect(mp.reconnectPeer).toHaveBeenCalledWith('p1');
    expect(mp.handlePeerLeft).not.toHaveBeenCalled();
  });

  test('gives up and runs handlePeerLeft teardown after MAX_PEER_RECONNECT_ATTEMPTS failures', () => {
    const mp = makeSystem();
    mp.reconnectPeer = jest.fn();
    mp.handlePeerLeft = jest.fn();
    const pc = makeFailedPc();
    mp.setupPeerConnection(pc, 'p1');

    for (let i = 0; i < MAX_PEER_RECONNECT_ATTEMPTS; i++) {
      pc.onconnectionstatechange();
    }
    expect(mp.handlePeerLeft).not.toHaveBeenCalled();

    pc.onconnectionstatechange(); // one more failure exceeds the cap

    expect(mp.handlePeerLeft).toHaveBeenCalledWith('p1');
    expect(mp.reconnectPeer).toHaveBeenCalledTimes(MAX_PEER_RECONNECT_ATTEMPTS);
  });

  test('giving up actually removes the ghost avatar and stops the stats gauge from drifting', () => {
    const mp = makeSystem();
    mp.reconnectPeer = jest.fn(); // stub out real renegotiation
    mp.createAvatar('p1', { color: 0x00ff00 });
    mp.peers.set('p1', { close: jest.fn() });
    mp.stats.connectedPeers = 1;
    const pc = makeFailedPc();
    mp.setupPeerConnection(pc, 'p1');

    for (let i = 0; i <= MAX_PEER_RECONNECT_ATTEMPTS; i++) {
      pc.onconnectionstatechange();
    }

    expect(mp.avatars.has('p1')).toBe(false);
    expect(mp.stats.connectedPeers).toBe(0);
  });

  test('a successful connection resets the reconnect-attempt counter', () => {
    const mp = makeSystem();
    mp.reconnectPeer = jest.fn();
    mp.handlePeerLeft = jest.fn();
    const pc = makeFailedPc();
    mp.setupPeerConnection(pc, 'p1');

    pc.onconnectionstatechange(); // 1 failure
    pc.connectionState = 'connected';
    pc.onconnectionstatechange(); // recovers
    pc.connectionState = 'failed';
    for (let i = 0; i < MAX_PEER_RECONNECT_ATTEMPTS; i++) {
      pc.onconnectionstatechange(); // counter restarted from 0, so this should not exceed the cap
    }

    expect(mp.handlePeerLeft).not.toHaveBeenCalled();
  });

  test('disconnect() clears any pending per-peer reconnect attempts', () => {
    const mp = makeSystem();
    mp._peerReconnectAttempts.set('p1', 2);
    mp.disconnect();
    expect(mp._peerReconnectAttempts.size).toBe(0);
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

describe('canSendOnChannel — data-channel backpressure gate', () => {
  test('false for a missing or non-open channel', () => {
    expect(canSendOnChannel(null)).toBe(false);
    expect(canSendOnChannel(undefined)).toBe(false);
    expect(canSendOnChannel({ readyState: 'connecting', bufferedAmount: 0 })).toBe(false);
    expect(canSendOnChannel({ readyState: 'closed', bufferedAmount: 0 })).toBe(false);
  });

  test('true for an open channel below the high-water mark', () => {
    expect(canSendOnChannel({ readyState: 'open', bufferedAmount: 0 })).toBe(true);
    expect(canSendOnChannel({ readyState: 'open', bufferedAmount: MAX_BUFFERED_BYTES })).toBe(true);
  });

  test('false for an open channel over the high-water mark (congested)', () => {
    expect(canSendOnChannel({ readyState: 'open', bufferedAmount: MAX_BUFFERED_BYTES + 1 })).toBe(false);
  });

  test('treats a missing bufferedAmount as 0 (degrades to send-if-open)', () => {
    expect(canSendOnChannel({ readyState: 'open' })).toBe(true);
  });

  test('respects a custom high-water mark', () => {
    expect(canSendOnChannel({ readyState: 'open', bufferedAmount: 100 }, 50)).toBe(false);
    expect(canSendOnChannel({ readyState: 'open', bufferedAmount: 40 }, 50)).toBe(true);
  });
});

describe('MultiplayerSystem send backpressure', () => {
  test('broadcast skips a congested channel and counts the drop', () => {
    const mp = makeSystem();
    const send = jest.fn();
    mp.dataChannels.set('slow', {
      readyState: 'open', bufferedAmount: MAX_BUFFERED_BYTES + 1, send
    });
    mp.broadcast({ type: 'position', x: 1 });
    expect(send).not.toHaveBeenCalled();
    expect(mp.stats.messagesDropped).toBe(1);
    expect(mp.stats.messagesSent).toBe(0);
  });

  test('broadcast sends on an uncongested channel', () => {
    const mp = makeSystem();
    const send = jest.fn();
    mp.dataChannels.set('ok', { readyState: 'open', bufferedAmount: 0, send });
    mp.broadcast({ type: 'position', x: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(mp.stats.messagesSent).toBe(1);
    expect(mp.stats.messagesDropped).toBe(0);
  });

  test('sendToPeer drops under backpressure without throwing', () => {
    const mp = makeSystem();
    const send = jest.fn();
    mp.dataChannels.set('p1', {
      readyState: 'open', bufferedAmount: MAX_BUFFERED_BYTES + 999, send
    });
    expect(() => mp.sendToPeer('p1', { type: 'pong' })).not.toThrow();
    expect(send).not.toHaveBeenCalled();
    expect(mp.stats.messagesDropped).toBe(1);
  });
});
