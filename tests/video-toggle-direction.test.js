/**
 * Session-390 direction fix — video-toggle parsed no direction: '一時停止'
 * on an already-paused video toggled it back to playing (and '再生して'
 * on a playing video paused it). The command now passes a 'play'|'pause'
 * hint to onVideoToggle, which reports 'already-*' instead of toggling —
 * the same design as private-mode's direction fix.
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

describe('VoiceCommands video-toggle (direction-aware)', () => {
  test.each(['一時停止', '動画を一時停止', 'ポーズ', 'pause the video'])(
    '"%s" passes want=pause to onVideoToggle',
    (p) => {
      const onVideoToggle = jest.fn(() => 'paused');
      const vc = makeSpeakingVC({ onVideoToggle });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('video-toggle');
      expect(onVideoToggle).toHaveBeenCalledWith('pause');
      expect(vc._spoken.at(-1)).toBe('一時停止します');
    }
  );

  test.each(['再生して', '動画を再生', '再開して', 'play the video', 'resume the video'])(
    '"%s" passes want=play to onVideoToggle',
    (p) => {
      const onVideoToggle = jest.fn(() => 'playing');
      const vc = makeSpeakingVC({ onVideoToggle });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('video-toggle');
      expect(onVideoToggle).toHaveBeenCalledWith('play');
      expect(vc._spoken.at(-1)).toBe('再生を再開します');
    }
  );

  test('"一時停止" on an already-paused video announces honestly, no flip', () => {
    const onVideoToggle = jest.fn((want) => (want === 'pause' ? 'already-paused' : 'paused'));
    const vc = makeSpeakingVC({ onVideoToggle });
    vc.processCommand('一時停止');
    expect(onVideoToggle).toHaveBeenCalledWith('pause');
    expect(vc._spoken.at(-1)).toBe('すでに一時停止中です');
  });

  test('"再生して" on a playing video announces honestly, no flip', () => {
    const onVideoToggle = jest.fn((want) => (want === 'play' ? 'already-playing' : 'playing'));
    const vc = makeSpeakingVC({ onVideoToggle });
    vc.processCommand('再生して');
    expect(onVideoToggle).toHaveBeenCalledWith('play');
    expect(vc._spoken.at(-1)).toBe('すでに再生中です');
  });

  test('still reports no active video honestly', () => {
    const vc = makeSpeakingVC({ onVideoToggle: () => null });
    vc.processCommand('pause video');
    expect(vc._spoken.at(-1)).toBe('再生中の動画がありません');
  });
});
