/**
 * Round-28 atoms:
 *   - next-word / prev-word — NVDA/JAWS Ctrl+Right/Left word caret
 *   - reopen-all — reopen every closed tab (Ctrl+Shift+T held)
 *   - mute-status — honest muted-state query (hoisted: /(un)?mute/ owns 'muted')
 *   - language-switch — voice-interface language (iOS Voice Control parity)
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

// ── mute-status ───────────────────────────────────────────────────────────────
describe('VoiceCommands mute-status', () => {
  test('\'ミュートかどうか\' answers the hook', () => {
    const vc = makeSpeakingVC({ onMuteStatus: () => true });
    vc.processCommand('ミュートかどうか');
    expect(vc._spoken.pop()).toBe('ミュートされています');
  });

  test('\'is it muted\' queries instead of toggling', () => {
    const onMuteStatus = jest.fn(() => false);
    const onMute = jest.fn();
    const vc = makeSpeakingVC({ onMuteStatus, onMute });
    vc.processCommand('is it muted');
    expect(onMute).not.toHaveBeenCalled();
    expect(vc._spoken.pop()).toBe('ミュートされていません');
  });

  test('no hook announces honestly', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('ミュートかどうか');
    expect(vc._spoken.pop()).toBe('確認できません');
  });

  test('bare \'ミュート\' still routes to mute-toggle', () => {
    const onMute = jest.fn(() => true);
    const vc = makeSpeakingVC({ onMute });
    vc.processCommand('ミュート');
    expect(onMute).toHaveBeenCalled();
  });
});

// ── reopen-all ────────────────────────────────────────────────────────────────
describe('VoiceCommands reopen-all', () => {
  test('\'閉じたタブをすべて開き直して\' loops the stack', () => {
    let i = 0;
    const urls = ['u1', 'u2', 'u3'];
    const vc = makeSpeakingVC({ tabManager: { reopenClosedTab: () => urls[i++] || null } });
    vc.processCommand('閉じたタブをすべて開き直して');
    expect(vc._spoken.pop()).toBe('3個のタブを開き直しました');
  });

  test('\'reopen all tabs\' routes in English', () => {
    let i = 0;
    const vc = makeSpeakingVC({ tabManager: { reopenClosedTab: () => ['u1'][i++] || null } });
    vc.processCommand('reopen all tabs');
    expect(vc._spoken.pop()).toBe('1個のタブを開き直しました');
  });

  test('empty stack announces honestly', () => {
    const vc = makeSpeakingVC({ tabManager: { reopenClosedTab: () => null } });
    vc.processCommand('閉じたタブをすべて開き直して');
    expect(vc._spoken.pop()).toBe('閉じたタブがありません');
  });
});

// ── next-word / prev-word ─────────────────────────────────────────────────────
describe('VoiceCommands next-word / prev-word', () => {
  test('\'次の単語\' speaks the word from the panel', () => {
    const vc = makeSpeakingVC({
      tabManager: { getActiveTab: () => ({ nextWord: () => ({ word: '次語', line: 0 }) }) }
    });
    vc.processCommand('次の単語');
    expect(vc._spoken.pop()).toBe('次語');
  });

  test('\'previous word\' routes with dir -1', () => {
    const nextWord = jest.fn(() => ({ word: 'w', line: 0 }));
    const vc = makeSpeakingVC({ tabManager: { getActiveTab: () => ({ nextWord }) } });
    vc.processCommand('previous word');
    expect(nextWord).toHaveBeenCalledWith(-1);
  });

  test('edge announces honestly', () => {
    const vc = makeSpeakingVC({ tabManager: { getActiveTab: () => ({ nextWord: () => null }) } });
    vc.processCommand('次の単語');
    expect(vc._spoken.pop()).toBe('これ以上進めません');
  });
});

// ── language-switch ───────────────────────────────────────────────────────────
describe('VoiceCommands language-switch', () => {
  test('\'英語にして\' switches to en-US and answers in English', () => {
    const vc = makeSpeakingVC();
    vc.recognition = { lang: 'ja-JP' };
    vc.processCommand('英語にして');
    expect(vc.language).toBe('en-US');
    expect(vc.recognition.lang).toBe('en-US');
    expect(vc._spoken.pop()).toBe('Switched to English');
  });

  test('\'日本語にして\' switches back to ja-JP', () => {
    const vc = makeSpeakingVC();
    vc.setLanguage('en-US');
    vc.processCommand('日本語にして');
    expect(vc.language).toBe('ja-JP');
    expect(vc._spoken.pop()).toBe('日本語に切り替えました');
  });
});

// ── WebPanel.nextWord (bound to hand-built state) ────────────────────────────
describe('WebPanel nextWord', () => {
  const RealWebPanel = jest.requireActual('../src/vr/browser/WebPanel.js').WebPanel;

  function readerPanel(lines) {
    const panel = Object.create(RealWebPanel.prototype);
    panel._contentState = 'reader';
    panel._readerLines = lines.map((t) => ({ text: t }));
    panel._readerScroll = 0;
    panel._readerScale = 1;
    panel._scrollMark = null;
    panel._wordCaret = null;
    panel._drawContent = jest.fn();
    return panel;
  }

  test('walks words across lines and follows with the scroll', () => {
    // 40 two-word lines overflow the ~16-line viewport so the scroll can move.
    const panel = readerPanel(Array.from({ length: 40 }, (_, i) => `w${i}a w${i}b`));
    expect(panel.nextWord(1).word).toBe('w0a');
    expect(panel.nextWord(1).word).toBe('w0b');
    const r = panel.nextWord(1);
    expect(r.word).toBe('w1a');
    expect(r.line).toBe(1);
    expect(panel._readerScroll).toBe(1); // scroll followed the caret
    expect(panel._scrollMark).toBe(0);   // ...and marked the jump
  });

  test('prev-word walks backwards and stops at the start', () => {
    const panel = readerPanel(['one', 'two']);
    const r = panel.nextWord(-1);          // caret inits at line end → 'one'
    expect(r.word).toBe('one');
    expect(panel.nextWord(-1)).toBeNull(); // article start
  });

  test('edge forward returns null and leaves caret', () => {
    const panel = readerPanel(['one']);
    panel.nextWord(1);
    expect(panel.nextWord(1)).toBeNull();
  });

  test('outside reader returns null', () => {
    const panel = readerPanel(['one']);
    panel._contentState = 'idle';
    expect(panel.nextWord(1)).toBeNull();
  });
});
