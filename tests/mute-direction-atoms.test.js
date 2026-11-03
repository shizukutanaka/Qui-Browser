/**
 * Session-391 direction fix — mute-toggle passed want=false for unmute
 * forms but never want=true for explicit mute forms, so 'ミュートにして'
 * on an already-muted page toggled it back OFF (the mute-toggle sibling
 * of the private-mode/video-toggle direction bugs). Explicit mute
 * intent now passes want=true; bare 'ミュート'/'音を切る' keep the
 * pinned toggle contract (undefined).
 */
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

beforeEach(() => {
  global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
    this.text = text;
  };
});

function makeSpeakingVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = {
    speak: (u) => spoken.push(u.text),
    cancel: () => {},
    speaking: false
  };
  vc.connectBrowser(opts);
  vc._spoken = spoken;
  return vc;
}

describe('VoiceCommands mute-toggle (direction-aware)', () => {
  test.each([
    'ミュートして',
    'ミュートにして',
    '消音して',
    '静かにして',
    '音を消す',
    '音消して',
    'このタブをミュート',
    '全部ミュート',
    'mute the video',
    'mute that',
    'be quiet',
    'make it quiet',
    'shut up'
  ])('"%s" passes want=true to onMute', (p) => {
    const onMute = jest.fn(() => true);
    const vc = makeSpeakingVC({ onMute });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('mute-toggle');
    expect(onMute).toHaveBeenCalledWith(true);
  });

  test.each(['ミュート解除して', 'ミュートを外して', '音をつけて', 'unmute'])('"%s" still passes want=false', (p) => {
    const onMute = jest.fn(() => false);
    const vc = makeSpeakingVC({ onMute });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('mute-toggle');
    expect(onMute).toHaveBeenCalledWith(false);
  });

  test('bare ミュート keeps the pinned toggle contract (want=undefined)', () => {
    const onMute = jest.fn(() => true);
    const vc = makeSpeakingVC({ onMute });
    vc.processCommand('ミュート');
    expect(onMute).toHaveBeenCalledWith(undefined);
    expect(vc._spoken.at(-1)).toBe('ミュート オンです');
  });

  test('an already-muted page answers honestly without toggling', () => {
    // Host semantics: target===current returns the state, no flip.
    const onMute = jest.fn((want) => (want === undefined ? false : want));
    const vc = makeSpeakingVC({ onMute });
    vc.processCommand('ミュートにして');
    expect(onMute).toHaveBeenCalledWith(true);
    expect(vc._spoken.at(-1)).toBe('ミュート オンです');
  });
});
