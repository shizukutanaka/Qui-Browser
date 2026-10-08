/**
 * Invariants for round 972 — `||`-defaults must not clobber legitimate falsy
 * option values.
 *
 * Defect class (Socratic audit): `options.x || default` treats 0 as "not
 * provided" even where 0 is a perfectly meaningful value. Concrete harms:
 *  - `SpatialAudio.createSource('s', { volume: 0 })` → silent source became
 *    full-volume; `{ rolloffFactor: 0 }` (global, non-attenuating sound)
 *    became distance-attenuated; `{ coneOuterGain: 0 }` (sealed directional
 *    beam) leaked at 0.3 outside the cone.
 *  - `vc.speak('x', { volume: 0 })` / `{ pitch: 0 }` → SpeechSynthesis spec
 *    values (volume 0–1, pitch 0–2) silently replaced by defaults.
 *
 * Fix: `??` defaults — only undefined/null trigger the fallback.
 */

const { SpatialAudio } = require('../src/vr/audio/SpatialAudio.js');
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

// Minimal Web Audio stub — same pattern as tests/spatial-audio.test.js.
const makePanner = () => ({
  panningModel: 'HRTF',
  distanceModel: 'exponential',
  refDistance: 1,
  maxDistance: 100,
  rolloffFactor: 1,
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
  positionX: { value: 0 },
  positionY: { value: 0 },
  positionZ: { value: 0 },
  connect: jest.fn()
});

const makeGain = () => ({ gain: { value: 1 }, connect: jest.fn() });

const makeAudioContext = () => ({
  state: 'running',
  sampleRate: 48000,
  currentTime: 0,
  listener: {},
  createPanner: jest.fn(() => makePanner()),
  createGain: jest.fn(() => makeGain()),
  createBuffer: jest.fn(() => ({
    numberOfChannels: 1,
    length: 0,
    sampleRate: 48000,
    duration: 0,
    getChannelData: () => new Float32Array(0)
  })),
  resume: jest.fn(() => Promise.resolve()),
  close: jest.fn()
});

global.window = global.window || {};
global.window.AudioContext = jest.fn(() => makeAudioContext());

describe('SpatialAudio.createSource — falsy options are honoured', () => {
  let audio;
  beforeEach(() => {
    audio = new SpatialAudio();
    audio.context = makeAudioContext();
  });

  test('volume: 0 produces a silent source, not full volume', () => {
    const source = audio.createSource('quiet', { volume: 0 });
    expect(source.volume).toBe(0);
  });

  test('playbackRate: 0 is honoured', () => {
    const source = audio.createSource('frozen', { playbackRate: 0 });
    expect(source.playbackRate).toBe(0);
  });

  test('rolloffFactor: 0 gives a non-attenuated (global) source', () => {
    const source = audio.createSource('global', { rolloffFactor: 0 });
    expect(source.panner.rolloffFactor).toBe(0);
  });

  test('refDistance/maxDistance: 0 are honoured', () => {
    const source = audio.createSource('zero', { refDistance: 0, maxDistance: 0 });
    expect(source.panner.refDistance).toBe(0);
    expect(source.panner.maxDistance).toBe(0);
  });

  test('directional cone: 0 angles and 0 outer gain are honoured', () => {
    const source = audio.createSource('beam', {
      directional: true,
      coneInnerAngle: 0,
      coneOuterAngle: 0,
      coneOuterGain: 0
    });
    expect(source.panner.coneInnerAngle).toBe(0);
    expect(source.panner.coneOuterAngle).toBe(0);
    expect(source.panner.coneOuterGain).toBe(0);
  });

  test('omitted options still get the documented defaults', () => {
    const plain = audio.createSource('plain', {});
    expect(plain.volume).toBe(1.0);
    expect(plain.playbackRate).toBe(1.0);
    expect(plain.panner.refDistance).toBe(audio.settings.refDistance);
    expect(plain.panner.rolloffFactor).toBe(audio.settings.rolloffFactor);
    const beam = audio.createSource('beamdef', { directional: true });
    expect(beam.panner.coneInnerAngle).toBe(60);
    expect(beam.panner.coneOuterAngle).toBe(120);
    expect(beam.panner.coneOuterGain).toBe(0.3);
  });
});

describe('VoiceCommands.speak — falsy options reach the utterance', () => {
  const spokenUtterances = [];
  let vc;
  let origSSU;

  beforeEach(() => {
    spokenUtterances.length = 0;
    vc = new VoiceCommands();
    vc.synthesis = { speak: (u) => spokenUtterances.push(u), cancel: () => {} };
    origSSU = global.SpeechSynthesisUtterance;
    global.SpeechSynthesisUtterance = function (text) {
      this.text = text;
    };
  });

  afterEach(() => {
    global.SpeechSynthesisUtterance = origSSU;
  });

  test('volume: 0 produces a silent utterance, not full volume', () => {
    vc.speak('テスト', { volume: 0 });
    expect(spokenUtterances).toHaveLength(1);
    expect(spokenUtterances[0].volume).toBe(0);
  });

  test('pitch: 0 is honoured (spec range 0–2)', () => {
    vc.speak('テスト', { pitch: 0 });
    expect(spokenUtterances[0].pitch).toBe(0);
  });

  test('rate: 0 is honoured — explicit values pass through verbatim', () => {
    vc.speak('テスト', { rate: 0 });
    expect(spokenUtterances[0].rate).toBe(0);
  });

  test("lang: '' is honoured — '' means inherit the document language", () => {
    vc.speak('テスト', { lang: '' });
    expect(spokenUtterances[0].lang).toBe('');
  });

  test('omitted options still get defaults', () => {
    vc.speak('テスト');
    const u = spokenUtterances[0];
    expect(u.volume).toBe(1.0);
    expect(u.rate).toBe(vc._speechRate);
    expect(u.pitch).toBe(vc._speechPitch);
    expect(u.lang).toBe(vc.language);
  });
});
