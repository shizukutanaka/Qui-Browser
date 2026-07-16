/**
 * Unit tests for SpatialAudio perceptual LOD (FR-5.2).
 * AudioContext is fully mocked so tests run in the Node environment.
 */

// Minimal stub that lets SpatialAudio.initialize() complete without throwing.
const makePanner = () => ({
  panningModel: 'HRTF',
  distanceModel: 'exponential',
  refDistance: 1,
  maxDistance: 100,
  rolloffFactor: 1,
  positionX: { value: 0 },
  positionY: { value: 0 },
  positionZ: { value: 0 },
  connect: jest.fn()
});

const makeGain = () => ({
  gain: { value: 1 },
  connect: jest.fn()
});

const makeAudioContext = () => ({
  state: 'running',
  sampleRate: 48000,
  currentTime: 0,
  baseLatency: 0,
  listener: {
    positionX: { value: 0 },
    positionY: { value: 0 },
    positionZ: { value: 0 },
    forwardX: { value: 0 },
    forwardY: { value: 0 },
    forwardZ: { value: 0 },
    upX: { value: 0 },
    upY: { value: 0 },
    upZ: { value: 0 }
  },
  createPanner: jest.fn(() => makePanner()),
  createGain: jest.fn(() => makeGain()),
  // The real AudioContext.resume() always returns a Promise (per the Web Audio
  // spec); mirror that so the production .then()/.catch() chain is exercised.
  resume: jest.fn(() => Promise.resolve()),
  close: jest.fn()
});

// Inject into global before requiring the module.
global.window = {
  AudioContext: jest.fn(() => makeAudioContext()),
  webkitAudioContext: undefined
};

const { SpatialAudio } = require('../src/vr/audio/SpatialAudio.js');

describe('SpatialAudio — perceptual LOD (FR-5.2)', () => {
  let audio;

  beforeEach(() => {
    // Reset the AudioContext mock so each test gets a fresh instance.
    global.window.AudioContext = jest.fn(() => makeAudioContext());
    audio = new SpatialAudio();
    // initialize() is async; the constructor kicks it off but we can
    // exercise LOD synchronously because LOD only touches this.sources
    // and this._listenerPos, neither of which depend on the async path.
  });

  test('default hrtfThreshold is 15 metres', () => {
    expect(audio.settings.hrtfThreshold).toBe(15);
  });

  test('_sourceDistance returns 0 for a source at the listener', () => {
    audio._listenerPos = { x: 1, y: 2, z: 3 };
    const source = { position: { x: 1, y: 2, z: 3 } };
    expect(audio._sourceDistance(source)).toBe(0);
  });

  test('_sourceDistance computes Euclidean distance correctly', () => {
    audio._listenerPos = { x: 0, y: 0, z: 0 };
    const source = { position: { x: 3, y: 4, z: 0 } };
    expect(audio._sourceDistance(source)).toBeCloseTo(5);
  });

  test('updateSourceLOD keeps HRTF for a nearby source', () => {
    const panner = makePanner(); // starts as 'HRTF'
    audio.sources.set('near', {
      panner,
      position: { x: 0, y: 0, z: 5 }  // 5 m away
    });
    audio._listenerPos = { x: 0, y: 0, z: 0 };
    audio.settings.enableHRTF = true;
    audio.settings.hrtfThreshold = 15;

    audio.updateSourceLOD('near');
    expect(panner.panningModel).toBe('HRTF');
  });

  test('updateSourceLOD downgrades to equalpower beyond threshold', () => {
    const panner = makePanner();
    audio.sources.set('far', {
      panner,
      position: { x: 0, y: 0, z: 20 }  // 20 m away
    });
    audio._listenerPos = { x: 0, y: 0, z: 0 };
    audio.settings.enableHRTF = true;
    audio.settings.hrtfThreshold = 15;

    audio.updateSourceLOD('far');
    expect(panner.panningModel).toBe('equalpower');
  });

  test('updateSourceLOD upgrades back to HRTF when listener moves close', () => {
    const panner = makePanner();
    panner.panningModel = 'equalpower';
    audio.sources.set('movable', {
      panner,
      position: { x: 0, y: 0, z: 20 }
    });
    audio.settings.enableHRTF = true;
    audio.settings.hrtfThreshold = 15;

    // Listener moves close.
    audio.setListenerPosition(0, 0, 18);
    audio.updateSourceLOD('movable');
    expect(panner.panningModel).toBe('HRTF');
  });

  test('updateSourceLOD always uses equalpower when enableHRTF is false', () => {
    const panner = makePanner();
    audio.sources.set('any', {
      panner,
      position: { x: 0, y: 0, z: 2 }  // very close
    });
    audio._listenerPos = { x: 0, y: 0, z: 0 };
    audio.settings.enableHRTF = false;

    audio.updateSourceLOD('any');
    expect(panner.panningModel).toBe('equalpower');
  });

  test('updateAllLOD counts HRTF vs equalPower sources in stats', () => {
    const pannerA = makePanner(); // will stay HRTF
    const pannerB = makePanner(); // will be downgraded

    audio.sources.set('a', { panner: pannerA, position: { x: 0, y: 0, z: 5 } });
    audio.sources.set('b', { panner: pannerB, position: { x: 0, y: 0, z: 20 } });
    audio._listenerPos = { x: 0, y: 0, z: 0 };
    audio.settings.enableHRTF = true;
    audio.settings.hrtfThreshold = 15;

    audio.updateAllLOD();
    expect(audio.stats.hrtfSources).toBe(1);
    expect(audio.stats.equalPowerSources).toBe(1);
  });

  test('getStats includes hrtfSources, equalPowerSources, and hrtfThreshold', () => {
    const stats = audio.getStats();
    expect(stats).toHaveProperty('hrtfSources');
    expect(stats).toHaveProperty('equalPowerSources');
    expect(stats).toHaveProperty('hrtfThreshold', 15);
  });
});

describe('SpatialAudio — spatial voice (FR-7.2)', () => {
  let audio, mockCtx;

  beforeEach(() => {
    mockCtx = makeAudioContext();
    // Add createMediaStreamSource to the mock context.
    mockCtx.createMediaStreamSource = jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn() }));
    global.window.AudioContext = jest.fn(() => mockCtx);
    audio = new SpatialAudio();
    // Manually set context for synchronous testing (initialize() is async).
    audio.context = mockCtx;
    audio.listener = mockCtx.listener;
  });

  test('createVoiceSource creates a source keyed as "voice:<peerId>"', () => {
    const stream = {};
    audio.createVoiceSource('peer1', stream);
    expect(audio.sources.has('voice:peer1')).toBe(true);
  });

  test('createVoiceSource routes MediaStream through a panner', () => {
    audio.createVoiceSource('peer1', {});
    expect(mockCtx.createMediaStreamSource).toHaveBeenCalledTimes(1);
    expect(mockCtx.createPanner).toHaveBeenCalled();
  });

  test('createVoiceSource sets initial position on the panner', () => {
    const panner = makePanner();
    mockCtx.createPanner = jest.fn(() => panner);
    audio.createVoiceSource('peer1', {}, { x: 1, y: 2, z: 3 });
    expect(panner.positionX.value).toBe(1);
    expect(panner.positionY.value).toBe(2);
    expect(panner.positionZ.value).toBe(3);
  });

  test('createVoiceSource is idempotent — returns existing source on repeat call', () => {
    audio.createVoiceSource('peer1', {});
    audio.createVoiceSource('peer1', {});
    expect(mockCtx.createMediaStreamSource).toHaveBeenCalledTimes(1);
  });

  test('createVoiceSource returns null when context is absent', () => {
    audio.context = null;
    expect(audio.createVoiceSource('p', {})).toBeNull();
  });

  test('removeVoiceSource disconnects and deletes the source', () => {
    audio.createVoiceSource('peer1', {});
    audio.removeVoiceSource('peer1');
    expect(audio.sources.has('voice:peer1')).toBe(false);
  });

  test('removeVoiceSource is safe when peer had no voice source', () => {
    expect(() => audio.removeVoiceSource('unknown')).not.toThrow();
  });

  test('updateVoicePosition delegates to setSourcePosition', () => {
    audio.createVoiceSource('peer1', {});
    const panner = audio.sources.get('voice:peer1').panner;
    audio.updateVoicePosition('peer1', 5, 1.7, -3);
    expect(panner.positionX.value).toBe(5);
    expect(panner.positionY.value).toBe(1.7);
    expect(panner.positionZ.value).toBe(-3);
  });
});

describe('SpatialAudio — autoplay-policy resume (suspended context)', () => {
  let listeners, removed, suspendedCtx;

  beforeEach(() => {
    // Capture every document listener add/remove so we can assert the
    // multi-gesture arming and teardown without a real DOM.
    listeners = [];
    removed = [];
    global.document = {
      addEventListener: (evt, fn) => listeners.push({ evt, fn }),
      removeEventListener: (evt, fn) => removed.push({ evt, fn })
    };
    suspendedCtx = makeAudioContext();
    suspendedCtx.state = 'suspended';
    global.window.AudioContext = jest.fn(() => suspendedCtx);
  });

  afterEach(() => {
    delete global.document;
  });

  // The constructor kicks off initialize(), whose listener-arming runs
  // synchronously (no await precedes it), so the listeners are present right
  // after construction — no extra initialize() call is needed (doing so would
  // double-arm).
  test('arms click, touchstart, and keydown when the context starts suspended', () => {
    new SpatialAudio();
    expect(listeners.map(l => l.evt).sort()).toEqual(['click', 'keydown', 'touchstart']);
  });

  test('a single gesture resumes the context and removes ALL gesture listeners', () => {
    new SpatialAudio();
    // Fire just one of the three (touchstart) — the others must still be torn down.
    const touch = listeners.find(l => l.evt === 'touchstart');
    touch.fn();
    expect(suspendedCtx.resume).toHaveBeenCalledTimes(1);
    expect(removed.map(l => l.evt).sort()).toEqual(['click', 'keydown', 'touchstart']);
  });

  test('dispose() removes the gesture listeners if no gesture ever fired', () => {
    const audio = new SpatialAudio();
    audio.dispose();
    expect(removed.map(l => l.evt).sort()).toEqual(['click', 'keydown', 'touchstart']);
  });

  test('running context arms no gesture listeners', () => {
    suspendedCtx.state = 'running';
    new SpatialAudio();
    expect(listeners).toHaveLength(0);
  });
});
