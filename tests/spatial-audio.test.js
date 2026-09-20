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

// play()/stop() lifecycle + the stale-onended race: restarting a source must
// not let the OLD buffer node's onended mutate the NEW playback's state.
describe('SpatialAudio — play/stop lifecycle', () => {
  const makeBufferSource = () => ({
    buffer: null,
    loop: false,
    playbackRate: { value: 1 },
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    disconnect: jest.fn(),
    onended: null
  });

  let audio, ctx;
  beforeEach(() => {
    ctx = makeAudioContext();
    ctx.createBufferSource = jest.fn(() => makeBufferSource());
    global.window.AudioContext = jest.fn(() => ctx);
    audio = new SpatialAudio();
    audio.context = ctx; // constructor's async initialize may not have run yet
  });

  const wire = (name) => audio.sources.set(name, {
    name, node: null, panner: makePanner(), gain: makeGain(),
    position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
    loop: false, volume: 1, playbackRate: 1, startTime: 0, isPlaying: false
  });

  test('play() wires buffer → panner, marks playing, counts active', () => {
    wire('s');
    audio.buffers.set('b', { _buf: true });
    audio.play('s', 'b', { x: 1, y: 0, z: 0 });
    const src = audio.sources.get('s');
    expect(src.node.buffer._buf).toBe(true);
    expect(src.node.connect).toHaveBeenCalledWith(src.panner);
    expect(src.isPlaying).toBe(true);
    expect(audio.stats.sourcesActive).toBe(1);
  });

  test('restart: old node onended must NOT clobber the new playback', () => {
    wire('s');
    audio.buffers.set('b', {});
    audio.play('s', 'b');           // first play → node A
    const nodeA = audio.sources.get('s').node;
    audio.play('s', 'b');           // restart → stop() then node B
    const src = audio.sources.get('s');
    const nodeB = src.node;
    expect(nodeB).not.toBe(nodeA);
    expect(audio.stats.sourcesActive).toBe(1);
    nodeA.onended();                // stale end event arrives late
    expect(src.isPlaying).toBe(true);            // was wrongly set false
    expect(audio.stats.sourcesActive).toBe(1);   // was wrongly decremented
    nodeB.onended();                // the live node ends naturally
    expect(src.isPlaying).toBe(false);
    expect(audio.stats.sourcesActive).toBe(0);
  });

  test('explicit stop() decrements sourcesActive exactly once', () => {
    wire('s');
    audio.buffers.set('b', {});
    audio.play('s', 'b');
    const node = audio.sources.get('s').node;
    audio.stop('s');
    // The stopped node's onended may still fire — must not double-decrement.
    if (node.onended) node.onended();
    expect(audio.stats.sourcesActive).toBe(0);
    expect(audio.sources.get('s').isPlaying).toBe(false);
  });

  test('stop() after a natural end does not drive sourcesActive negative', () => {
    wire('s');
    audio.buffers.set('b', {});
    audio.play('s', 'b');
    audio.sources.get('s').node.onended(); // natural end → active 0
    audio.stop('s');                       // explicit stop on ended source
    expect(audio.stats.sourcesActive).toBe(0);
  });
});

describe('SpatialAudio — source/listener plumbing (uncovered layer)', () => {
  let audio;
  let ctx;

  // initialize() runs synchronously to this.context/this.listener, so a
  // constructed instance is ready without awaiting anything.
  const initAudio = async () => {
    const context = makeAudioContext();
    global.window.AudioContext = jest.fn(() => context);
    const a = new SpatialAudio();
    return { a, context };
  };

  test('createSource wires panner -> gain -> destination and registers the source', async () => {
    const { a, context } = await initAudio();
    const src = a.createSource('bell', { volume: 0.5, refDistance: 2 });
    expect(src.panner.connect).toHaveBeenCalledWith(src.gain);
    expect(src.gain.connect).toHaveBeenCalledWith(context.destination);
    expect(src.gain.gain.value).toBeCloseTo(0.5 * a.settings.masterVolume);
    expect(src.panner.refDistance).toBe(2);
    expect(a.sources.get('bell')).toBe(src);
  });

  test('setSourcePosition writes AudioParams and re-evaluates LOD', async () => {
    const { a } = await initAudio();
    const src = a.createSource('s');
    a.setListenerPosition(0, 0, 0);
    a.updateSourceLOD('s');
    expect(src.panner.panningModel).toBe('HRTF'); // at the listener
    a.setSourcePosition('s', 0, 0, -100); // beyond hrtfThreshold (15 m)
    expect(src.panner.positionZ.value).toBe(-100);
    expect(src.panner.panningModel).toBe('equalpower');
  });

  test('updateAllLOD counts HRTF vs equalpower sources into stats', async () => {
    const { a } = await initAudio();
    const near = a.createSource('near');
    const far = a.createSource('far');
    a.setListenerPosition(0, 0, 0);
    near.position = { x: 0, y: 0, z: 2 };
    far.position = { x: 0, y: 0, z: 50 };
    a.updateAllLOD();
    expect(a.stats.hrtfSources).toBe(1);
    expect(a.stats.equalPowerSources).toBe(1);
  });

  test('setListenerPosition uses AudioParams when present', async () => {
    const { a, context } = await initAudio();
    a.setListenerPosition(1, 2, 3);
    expect(context.listener.positionX.value).toBe(1);
    expect(context.listener.positionZ.value).toBe(3);
    expect(a._listenerPos).toEqual({ x: 1, y: 2, z: 3 });
  });

  test('setListenerPosition falls back to setPosition on legacy listeners', async () => {
    const { a } = await initAudio();
    a.listener = { setPosition: jest.fn() }; // no positionX
    a.setListenerPosition(4, 5, 6);
    expect(a.listener.setPosition).toHaveBeenCalledWith(4, 5, 6);
    expect(a._listenerPos).toEqual({ x: 4, y: 5, z: 6 });
  });

  test('updateListenerFromCamera copies camera pose and re-runs LOD', async () => {
    const { a, context } = await initAudio();
    const src = a.createSource('s');
    a.setListenerPosition(0, 0, 0);
    src.position = { x: 0, y: 0, z: 40 };
    a.updateSourceLOD('s');
    expect(src.panner.panningModel).toBe('equalpower');

    const camera = {
      getWorldPosition: (v) => v.set(0, 0, 39), // teleports next to the source
      getWorldQuaternion: (q) => q // identity quaternion
    };
    a.updateListenerFromCamera(camera);
    expect(context.listener.positionZ.value).toBe(39);
    // Listener is now 1 m from the source -> HRTF tier.
    expect(src.panner.panningModel).toBe('HRTF');
  });

  test('simulateDoppler raises playbackRate with radial velocity', async () => {
    const { a } = await initAudio();
    const node = { playbackRate: { value: 1 } };
    const src = { velocity: { x: 34.33, y: 0, z: 0 }, playbackRate: 1.0, node };
    a.simulateDoppler(src);
    // 34.33 m/s = mach 0.1 -> factor 1.1
    expect(node.playbackRate.value).toBeCloseTo(1.1);
  });

  test('setMasterVolume clamps to [0,1] and rescales every source gain', async () => {
    const { a } = await initAudio();
    const s1 = a.createSource('a', { volume: 0.8 });
    a.setMasterVolume(1.5);
    expect(a.settings.masterVolume).toBe(1);
    expect(s1.gain.gain.value).toBeCloseTo(0.8);
    a.setMasterVolume(0.5);
    expect(s1.gain.gain.value).toBeCloseTo(0.4);
  });

  test('fadeVolume schedules a ramp on the gain AudioParam', async () => {
    const { a } = await initAudio();
    const src = a.createSource('f');
    src.gain.gain.cancelScheduledValues = jest.fn();
    src.gain.gain.setValueAtTime = jest.fn();
    src.gain.gain.linearRampToValueAtTime = jest.fn();
    a.fadeVolume('f', 0.2, 2);
    expect(src.gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.2 * a.settings.masterVolume, a.context.currentTime + 2
    );
    expect(src.volume).toBe(0.2);
  });
});
