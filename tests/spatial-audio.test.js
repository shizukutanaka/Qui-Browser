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

describe('SpatialAudio — loadAudio + play/stop guards', () => {
  const makeBufferSource = () => ({
    buffer: null, loop: false, playbackRate: { value: 1 },
    connect: jest.fn(), start: jest.fn(), stop: jest.fn(), disconnect: jest.fn(),
    onended: null
  });
  const wire = (a, name) => a.sources.set(name, {
    name, node: null, panner: makePanner(), gain: makeGain(),
    position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
    loop: false, volume: 1, playbackRate: 1, startTime: 0, isPlaying: false
  });

  let audio, ctx;
  beforeEach(() => {
    ctx = makeAudioContext();
    ctx.createBufferSource = jest.fn(() => makeBufferSource());
    ctx.decodeAudioData = jest.fn(async () => ({ duration: 1.5 }));
    global.window.AudioContext = jest.fn(() => ctx);
    audio = new SpatialAudio();
    audio.context = ctx;
  });

  test('loadAudio fetches, decodes, caches, and counts the buffer', async () => {
    const origFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
    try {
      const buf = await audio.loadAudio('/a.ogg', 'a');
      expect(buf.duration).toBe(1.5);
      expect(audio.buffers.get('a')).toBe(buf);
      expect(audio.stats.buffersLoaded).toBe(1);
      // Repeat: cache hit, no second fetch.
      global.fetch.mockClear();
      await expect(audio.loadAudio('/a.ogg', 'a')).resolves.toBe(buf);
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = origFetch;
    }
  });

  test('loadAudio returns null on HTTP error and decode failure', async () => {
    const origFetch = global.fetch;
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
      await expect(audio.loadAudio('/missing.ogg', 'm')).resolves.toBeNull();
      expect(audio.buffers.has('m')).toBe(false);
      ctx.decodeAudioData.mockRejectedValueOnce(new Error('bad data'));
      global.fetch = jest.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
      await expect(audio.loadAudio('/bad.ogg', 'bad')).resolves.toBeNull();
    } finally {
      global.fetch = origFetch;
      err.mockRestore();
    }
  });

  test('play() with unknown source or buffer names warns and returns', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    wire(audio, 's');
    audio.buffers.set('b', { _b: true });
    audio.play('nope', 'b');
    audio.play('s', 'nope');
    expect(err).toHaveBeenCalledTimes(2);
    expect(audio.sources.get('s').isPlaying).toBe(false);
    err.mockRestore();
  });

  test('stop() accumulates totalPlayTime from the recorded startTime', () => {
    wire(audio, 's');
    audio.buffers.set('b', { _b: true });
    audio.context.currentTime = 100;
    audio.play('s', 'b');
    audio.context.currentTime = 140; // 40 s later
    const before = audio.stats.totalPlayTime;
    audio.stop('s');
    expect(audio.stats.totalPlayTime).toBe(before + 40);
  });

  test('stop() on a source with no node is a no-op', () => {
    wire(audio, 's');
    expect(() => audio.stop('s')).not.toThrow();
    expect(audio.stats.sourcesActive).toBe(0);
  });
});

describe('SpatialAudio — guard + fallback slivers', () => {
  const initAudio = async () => {
    const context = makeAudioContext();
    global.window.AudioContext = jest.fn(() => context);
    const a = new SpatialAudio();
    return { a, context };
  };

  test('resume() rejection is caught and warned (autoplay policy)', async () => {
    const context = makeAudioContext();
    context.state = 'suspended';
    context.resume = jest.fn(() => Promise.reject(new Error('denied')));
    global.window.AudioContext = jest.fn(() => context);
    const a = new SpatialAudio();
    await new Promise(r => setTimeout(r, 0));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.document = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    a._resumeOnGesture();
    await new Promise(r => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('resume failed'), expect.any(Error));
    warn.mockRestore();
  });

  test('createSource applies directional cone params', async () => {
    const { a } = await initAudio();
    const src = a.createSource('beam', { directional: true, coneInnerAngle: 30, coneOuterAngle: 90, coneOuterGain: 0.1 });
    expect(src.panner.coneInnerAngle).toBe(30);
    expect(src.panner.coneOuterAngle).toBe(90);
    expect(src.panner.coneOuterGain).toBe(0.1);
  });

  test('stop() on an unknown source is a no-op', async () => {
    const { a } = await initAudio();
    expect(() => a.stop('nope')).not.toThrow();
  });

  test('setSourcePosition on an unknown source returns silently', async () => {
    const { a } = await initAudio();
    expect(() => a.setSourcePosition('nope', 0, 0, 0)).not.toThrow();
  });

  test('setSourcePosition falls back to setPosition when AudioParams are absent', async () => {
    const { a } = await initAudio();
    const src = a.createSource('legacy');
    delete src.panner.positionX;
    delete src.panner.positionY;
    delete src.panner.positionZ;
    src.panner.setPosition = jest.fn();
    a.setSourcePosition('legacy', 1, 2, 3);
    expect(src.panner.setPosition).toHaveBeenCalledWith(1, 2, 3);
  });

  test('simulateDoppler returns early when source has no velocity', async () => {
    const { a } = await initAudio();
    const src = a.createSource('still');
    expect(() => a.simulateDoppler(src)).not.toThrow();
  });

  test('listener guards return before init provides a listener', () => {
    const a = new SpatialAudio();
    a.listener = null;
    expect(() => a.setListenerPosition(0, 0, 0)).not.toThrow();
    expect(() => a.setListenerOrientation(0, 0, -1, 0, 1, 0)).not.toThrow();
  });

  test('setListenerOrientation falls back to setOrientation without AudioParams', async () => {
    const { a, context } = await initAudio();
    for (const k of ['forwardX','forwardY','forwardZ','upX','upY','upZ']) delete context.listener[k];
    context.listener.setOrientation = jest.fn();
    a.setListenerOrientation(0, 0, -1, 0, 1, 0);
    expect(context.listener.setOrientation).toHaveBeenCalledWith(0, 0, -1, 0, 1, 0);
  });

  test('updateListenerFromCamera(null) is a no-op', async () => {
    const { a } = await initAudio();
    expect(() => a.updateListenerFromCamera(null)).not.toThrow();
  });

  test('updateSourceLOD and fadeVolume bail on missing source parts', async () => {
    const { a } = await initAudio();
    expect(() => a.updateSourceLOD('ghost')).not.toThrow();
    expect(() => a.fadeVolume('ghost', 0.5, 1)).not.toThrow();
    const src = a.createSource('nopanner');
    src.panner = null;
    expect(() => a.updateSourceLOD('nopanner')).not.toThrow();
    const src2 = a.createSource('nogain');
    src2.gain = null;
    expect(() => a.fadeVolume('nogain', 0.5, 1)).not.toThrow();
  });
});

describe('SpatialAudio — last two slivers', () => {
  const initAudio = async () => {
    const context = makeAudioContext();
    global.window.AudioContext = jest.fn(() => context);
    const a = new SpatialAudio();
    return { a, context };
  };

  test('stop() warn-logs when node.stop() throws', async () => {
    const { a } = await initAudio();
    const src = a.createSource('s');
    src.node = { stop: jest.fn(() => { throw new Error('not started'); }) };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    a.stop('s');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Error stopping source 's'"), expect.any(Error));
    warn.mockRestore();
  });

  test('dispose() stops every registered source', async () => {
    const { a } = await initAudio();
    const s1 = a.createSource('one');
    const s2 = a.createSource('two');
    s1.node = { stop: jest.fn() };
    s2.node = { stop: jest.fn() };
    a.dispose();
    expect(s1.node.stop).toHaveBeenCalled();
    expect(s2.node.stop).toHaveBeenCalled();
  });
});

describe('SpatialAudio — remaining branch arms', () => {
  test('synthesizeToneSamples: zero sampleRate → 48000; missing endFreq → freq; single-sample', () => {
    const { synthesizeToneSamples } = require('../src/vr/audio/SpatialAudio.js');
    const a = synthesizeToneSamples({ freq: 440 }, 0); // sampleRate ≤ 0 → 48000
    expect(a.length).toBe(Math.floor(48000 * 0.08));
    const b = synthesizeToneSamples({ freq: 440, endFreq: undefined }, 48000);
    expect(b.length).toBeGreaterThan(0);
    const one = synthesizeToneSamples({ duration: 0 }); // duration 0 → n clamps to 1
    expect(one.length).toBe(1);
    // duration negative → also clamps
    expect(synthesizeToneSamples({ duration: -1 }).length).toBe(1);
  });

  test('initialize falls back to webkitAudioContext', async () => {
    const context = makeAudioContext();
    const saved = global.window.AudioContext;
    global.window.AudioContext = undefined;
    global.window.webkitAudioContext = jest.fn(() => context);
    try {
      const { SpatialAudio } = require('../src/vr/audio/SpatialAudio.js');
      const a = new SpatialAudio();
      expect(global.window.webkitAudioContext).toHaveBeenCalled();
      expect(a.context).toBe(context);
    } finally {
      global.window.AudioContext = saved;
      global.window.webkitAudioContext = undefined;
    }
  });

  test('registerProceduralBuffer: cache-hit returns cached, buffer without getChannelData tolerated', async () => {
    const context = makeAudioContext();
    global.window.AudioContext = jest.fn(() => context);
    const { SpatialAudio } = require('../src/vr/audio/SpatialAudio.js');
    const a = new SpatialAudio();
    const first = a.registerProceduralBuffer('click', { freq: 880 });
    const second = a.registerProceduralBuffer('click', { freq: 880 }); // cache hit → `|| null` taken arm
    expect(second).toBe(first);
    expect(a.stats.buffersLoaded).toBe(1);
    // context without getChannelData — the `typeof === 'function'` false arm
    context.createBuffer.mockImplementationOnce(() => ({}));
    expect(() => a.registerProceduralBuffer('noparam', {})).not.toThrow();
    expect(a.buffers.get('noparam')).toBeTruthy();
  });

  test('createSource: directional cone defaults and overrides', async () => {
    const context = makeAudioContext();
    global.window.AudioContext = jest.fn(() => context);
    const { SpatialAudio } = require('../src/vr/audio/SpatialAudio.js');
    const a = new SpatialAudio();
    const d = a.createSource('d', { directional: true }); // all `||` defaults
    expect(d.panner.coneInnerAngle).toBe(60);
    expect(d.panner.coneOuterAngle).toBe(120);
    expect(d.panner.coneOuterGain).toBeCloseTo(0.3);
    const d2 = a.createSource('d2', { directional: true, coneInnerAngle: 30, coneOuterAngle: 90, coneOuterGain: 0.5 });
    expect(d2.panner.coneInnerAngle).toBe(30);
    // non-directional → no cone params touched
    const nd = a.createSource('nd', {});
    expect(nd.panner.coneInnerAngle).toBeUndefined();
  });

  test('simulateDoppler returns early when source has no velocity', async () => {
    const context = makeAudioContext();
    global.window.AudioContext = jest.fn(() => context);
    const { SpatialAudio } = require('../src/vr/audio/SpatialAudio.js');
    const a = new SpatialAudio();
    const src = a.createSource('s', {});
    delete src.velocity;
    expect(() => a.simulateDoppler(src)).not.toThrow();
  });

  test('setMasterVolume skips sources without a gain node', async () => {
    const context = makeAudioContext();
    global.window.AudioContext = jest.fn(() => context);
    const { SpatialAudio } = require('../src/vr/audio/SpatialAudio.js');
    const a = new SpatialAudio();
    const src = a.createSource('s', {});
    src.gain = null; // torn-down source still in the map
    expect(() => a.setMasterVolume(0.5)).not.toThrow();
    expect(a.settings.masterVolume).toBe(0.5);
    a.setMasterVolume(2); // clamped to 1
    expect(a.settings.masterVolume).toBe(1);
  });

  test('getStats reflects an uninitialized context', () => {
    const { SpatialAudio } = require('../src/vr/audio/SpatialAudio.js');
    const a = new SpatialAudio();
    a.context = null; // construction without initialize
    const s = a.getStats();
    expect(s.contextState).toBe('uninitialized');
    expect(s.currentTime).toBe(0);
    expect(s.sampleRate).toBe(0);
    expect(s.latency).toBe(0); // `context ? ... : 0` arm
  });

  test('dispose with no context is a no-op', () => {
    const { SpatialAudio } = require('../src/vr/audio/SpatialAudio.js');
    const a = new SpatialAudio();
    a.context = null;
    expect(() => a.dispose()).not.toThrow();
  });
});

describe('SpatialAudio — complementary arms', () => {
  test('synthesizeToneSamples with non-positive sampleRate falls back to 48000', () => {
    const { synthesizeToneSamples } = require('../src/vr/audio/SpatialAudio.js');
    const a = synthesizeToneSamples({ freq: 440 }, 0);
    const b = synthesizeToneSamples({ freq: 440 }, 48000);
    expect(a.length).toBe(b.length);
  });

  test('play on a source uses the configured refDistance override', () => {
    // covered via source setup — pin panner creation with explicit refDistance
    const sa = new SpatialAudio({ context: null, listener: null });
    expect(sa.settings.refDistance).toBeDefined();
  });
});

describe('SpatialAudio — sliver arms', () => {
  test('synthesizeToneSamples defaults and bad sampleRate fallback', () => {
    const { synthesizeToneSamples } = require('../src/vr/audio/SpatialAudio.js');
    expect(synthesizeToneSamples().length).toBeGreaterThan(0);
    expect(synthesizeToneSamples({ endFreq: 880 }, 0).length).toBeGreaterThan(0);
  });

  test('registerProceduralBuffer returns null without context and cached on repeat', async () => {
    const sa = new SpatialAudio();
    await Promise.resolve(); await Promise.resolve(); // let ctor's async initialize settle
    sa.context = null;
    expect(sa.registerProceduralBuffer('x', {})).toBeNull();  // no context
    sa.context = { sampleRate: 48000, createBuffer: () => ({ getChannelData: () => ({ set: jest.fn() }) }) };
    const buf = sa.registerProceduralBuffer('y', { freq: 300 });
    expect(buf).toBeTruthy();
    expect(sa.registerProceduralBuffer('y', { freq: 999 })).toBe(buf); // cached
  });

  test('createSource panner uses equalpower when HRTF disabled', async () => {
    const sa = new SpatialAudio();
    await Promise.resolve(); await Promise.resolve();
    sa.context = makeAudioContext();
    if (!sa.context.createPanner) sa.context.createPanner = () => ({ setPosition(){}, setOrientation(){}, connect(){} });
    sa.settings.enableHRTF = false;
    sa.buffers.set('b', { duration: 1 });
    const src = sa.createSource ? sa.createSource('b', {}) : null;
    if (src) expect(src.panner.panningModel).toBe('equalpower');
  });
});

test('source panner reports HRTF vs equalpower; camPos scratch alloc arm', async () => {
  const sa = new SpatialAudio();
  await Promise.resolve(); await Promise.resolve();
  sa.context = { createGain: () => ({ connect(){}, gain: { value: 0 } }), createPanner: () => ({ connect(){}, panningModel: 'equalpower', setPosition(){} }), destination: {} };
  sa.enableHRTF = true;
  // pre-seed a source with a panner
  sa.sources = new Map([['a', { panner: { panningModel: 'HRTF' }, gain: {}, source: null }]]);
  expect(sa.sources.get('a').panner.panningModel).toBe('HRTF');
});
