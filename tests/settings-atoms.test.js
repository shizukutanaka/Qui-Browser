/**
 * Round-9 settings & status atoms — voice access to the flagship a11y
 * steppers plus status announcements:
 *   - caption-size-up/down → onCaptionScale(±0.25)  (a voice-only user
 *     cannot reach the settings panel mid-immersion)
 *   - dwell-time-up/down   → onDwellTime(±250 ms)
 *   - volume-status        → onVolumeStatus()        ("what's the volume")
 *   - time                 → current clock announce  (NVDA Insert+F12)
 * Host hooks follow the _onVolume pattern: set in connectBrowser, the
 * commands announce the returned value honestly (null = at the stepper's
 * boundary).
 */

global.SpeechSynthesisUtterance = function (text) { this.text = text; };

const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeSpeakingVC(extra = {}) {
  const vc = new VoiceCommands();
  vc.callbacks.onSpeak = () => {};
  vc.connectBrowser(extra);
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: jest.fn() };
  vc._spoken = spoken;
  return vc;
}

// ── volume-status ─────────────────────────────────────────────────────────────
describe('volume-status voice command', () => {
  test('"音量は" announces the level from the host hook', () => {
    const vc = makeSpeakingVC({ onVolumeStatus: jest.fn(() => 60) });
    vc.processCommand('音量は');
    expect(vc._spoken).toContain('音量は60%です');
  });

  test('reports honestly when the level is unavailable', () => {
    const vc = makeSpeakingVC({ onVolumeStatus: () => null });
    vc.processCommand('今の音量');
    expect(vc._spoken).toContain('音量を取得できません');
  });

  test('"音量上げる" still routes to volume-up, not status', () => {
    const onVolume = jest.fn();
    const onVolumeStatus = jest.fn(() => 50);
    const vc = makeSpeakingVC({ onVolume, onVolumeStatus });
    vc.processCommand('音量上げる');
    expect(onVolume).toHaveBeenCalledWith(0.1);
    expect(onVolumeStatus).not.toHaveBeenCalled();
  });
});

// ── caption size by voice ─────────────────────────────────────────────────────
describe('caption-size voice commands', () => {
  test('"キャプションを大きく" steps the scale up and announces it', () => {
    const onCaptionScale = jest.fn(() => 1.25);
    const vc = makeSpeakingVC({ onCaptionScale });
    vc.processCommand('キャプションを大きく');
    expect(onCaptionScale).toHaveBeenCalledWith(0.25);
    expect(vc._spoken).toContain('キャプションサイズ 1.25倍');
  });

  test('"キャプションを小さく" steps the scale down and announces it', () => {
    const onCaptionScale = jest.fn(() => 0.75);
    const vc = makeSpeakingVC({ onCaptionScale });
    vc.processCommand('キャプションを小さく');
    expect(onCaptionScale).toHaveBeenCalledWith(-0.25);
    expect(vc._spoken).toContain('キャプションサイズ 0.75倍');
  });

  test('at the ceiling the command says so instead of lying', () => {
    const vc = makeSpeakingVC({ onCaptionScale: () => null });
    vc.processCommand('キャプションを大きく');
    expect(vc._spoken).toContain('キャプションサイズはこれ以上大きくできません');
  });

  test('at the floor the down command says so too', () => {
    const vc = makeSpeakingVC({ onCaptionScale: () => null });
    vc.processCommand('smaller captions');
    expect(vc._spoken).toContain('キャプションサイズはこれ以上小さくできません');
  });

  test('no host hook → honest "cannot" announce', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('キャプションを大きく');
    expect(vc._spoken).toContain('キャプションサイズはこれ以上大きくできません');
  });
});

// ── dwell time by voice ───────────────────────────────────────────────────────
describe('dwell-time voice commands', () => {
  test('"注視時間を長く" steps the dwell time up', () => {
    const onDwellTime = jest.fn(() => 1250);
    const vc = makeSpeakingVC({ onDwellTime });
    vc.processCommand('注視時間を長く');
    expect(onDwellTime).toHaveBeenCalledWith(250);
    expect(vc._spoken).toContain('注視時間 1250ms');
  });

  test('"注視時間を短く" steps it down', () => {
    const onDwellTime = jest.fn(() => 750);
    const vc = makeSpeakingVC({ onDwellTime });
    vc.processCommand('注視時間を短く');
    expect(onDwellTime).toHaveBeenCalledWith(-250);
    expect(vc._spoken).toContain('注視時間 750ms');
  });

  test('"注視時間を延ばして" is an accepted alias for the up command', () => {
    const onDwellTime = jest.fn(() => 1000);
    const vc = makeSpeakingVC({ onDwellTime });
    vc.processCommand('注視時間を延ばして');
    expect(onDwellTime).toHaveBeenCalledWith(250);
  });

  test('at the ceiling the command says so', () => {
    const vc = makeSpeakingVC({ onDwellTime: () => null });
    vc.processCommand('longer dwell');
    expect(vc._spoken).toContain('注視時間はこれ以上長くできません');
  });
});

// ── current time ──────────────────────────────────────────────────────────────
describe('time voice command', () => {
  test('"今何時" speaks the current time in Japanese format', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('今何時');
    expect(vc._spoken[vc._spoken.length - 1]).toMatch(/^現在時刻は\d{1,2}時\d{2}分です$/);
  });

  test('"what time is it" works in English too', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('what time is it');
    expect(vc._spoken[vc._spoken.length - 1]).toMatch(/^現在時刻は/);
  });
});
