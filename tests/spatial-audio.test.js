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
  createBuffer: jest.fn((channels, length, sampleRate) => {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      numberOfChannels: channels, length, sampleRate,
      duration: length / sampleRate,
      getChannelData: (c) => data[c]
    };
  }),
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

const { SpatialAudio, synthesizeToneSamples } = require('../src/vr/audio/SpatialAudio.js');

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

// setMasterVolume drives the "Sound Volume" settings-panel stepper — the first
// real caller of this previously-unwired method. It must clamp to [0,1] and
// re-scale every active source's gain by its own per-source volume.
describe('SpatialAudio — master volume', () => {
  let audio;
  beforeEach(() => {
    global.window.AudioContext = jest.fn(() => makeAudioContext());
    audio = new SpatialAudio();
  });

  test('clamps the master volume into [0, 1]', () => {
    audio.setMasterVolume(1.5);
    expect(audio.settings.masterVolume).toBe(1);
    audio.setMasterVolume(-0.5);
    expect(audio.settings.masterVolume).toBe(0);
    audio.setMasterVolume(0.4);
    expect(audio.settings.masterVolume).toBeCloseTo(0.4);
  });

  test('re-scales each active source gain by source.volume * masterVolume', () => {
    audio.sources.set('a', { volume: 0.5, gain: { gain: { value: 1 } } });
    audio.sources.set('b', { volume: 1.0, gain: { gain: { value: 1 } } });

    audio.setMasterVolume(0.5);

    expect(audio.sources.get('a').gain.gain.value).toBeCloseTo(0.25); // 0.5 * 0.5
    expect(audio.sources.get('b').gain.gain.value).toBeCloseTo(0.5);  // 1.0 * 0.5
  });

  test('muting (0) drops every source gain to 0 without discarding source.volume', () => {
    audio.sources.set('a', { volume: 0.8, gain: { gain: { value: 0.8 } } });
    audio.setMasterVolume(0);
    expect(audio.sources.get('a').gain.gain.value).toBe(0);
    // Per-source volume is preserved so restoring master volume brings it back.
    expect(audio.sources.get('a').volume).toBe(0.8);
    audio.setMasterVolume(1);
    expect(audio.sources.get('a').gain.gain.value).toBeCloseTo(0.8);
  });
});

// Procedural fallback so interaction sounds play even though the packaged .mp3
// files are absent from the repo (they never decoded, and no source existed).
describe('synthesizeToneSamples (pure)', () => {
  test('returns floor(sampleRate*duration) samples', () => {
    expect(synthesizeToneSamples({ duration: 0.05 }, 48000)).toHaveLength(2400);
  });

  test('all samples stay within [-1, 1] for gain <= 1', () => {
    const s = synthesizeToneSamples({ freq: 880, duration: 0.06, decay: 45 }, 48000);
    for (const v of s) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test('amplitude envelope decays (early energy > late energy)', () => {
    const s = synthesizeToneSamples({ freq: 600, duration: 0.1, decay: 30 }, 48000);
    const peak = (arr, a, b) => arr.slice(a, b).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    const early = peak(s, 0, Math.floor(s.length * 0.1));
    const late = peak(s, Math.floor(s.length * 0.9), s.length);
    expect(early).toBeGreaterThan(late);
  });

  test('gain scales the peak amplitude down', () => {
    const full = synthesizeToneSamples({ freq: 600, duration: 0.05, decay: 20, gain: 1 }, 48000);
    const half = synthesizeToneSamples({ freq: 600, duration: 0.05, decay: 20, gain: 0.5 }, 48000);
    const peak = (arr) => arr.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak(half)).toBeLessThan(peak(full));
  });

  test('a gliding tone (endFreq set) does not throw and stays bounded', () => {
    const s = synthesizeToneSamples({ freq: 520, endFreq: 784, duration: 0.14, decay: 12 }, 48000);
    expect(s.length).toBeGreaterThan(0);
    expect(Math.max(...s.map(Math.abs))).toBeLessThanOrEqual(1);
  });
});

describe('SpatialAudio.registerProceduralBuffer', () => {
  let audio;
  beforeEach(() => {
    global.window.AudioContext = jest.fn(() => makeAudioContext());
    audio = new SpatialAudio();
  });

  test('creates and stores a buffer under the given name', () => {
    const buf = audio.registerProceduralBuffer('click', { freq: 880, duration: 0.06 });
    expect(buf).not.toBeNull();
    expect(audio.buffers.get('click')).toBe(buf);
    expect(buf.length).toBe(Math.floor(48000 * 0.06));
  });

  test('does not overwrite a buffer that is already loaded (real file wins)', () => {
    const real = { length: 999, _real: true };
    audio.buffers.set('click', real);
    const out = audio.registerProceduralBuffer('click', { freq: 880, duration: 0.06 });
    expect(out).toBe(real);
    expect(audio.buffers.get('click')).toBe(real);
  });

  test('no-ops without an AudioContext', () => {
    audio.context = null;
    expect(audio.registerProceduralBuffer('x', { duration: 0.05 })).toBeNull();
    expect(audio.buffers.has('x')).toBe(false);
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
