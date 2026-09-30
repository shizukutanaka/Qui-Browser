/**
 * Relative-position & repair atoms (round 69).
 *
 * Probe-driven: '2個前のタブ'/'最後から二番目' were swallowed by tab-by-name
 * (searching '二個前' as a title), 'go to the end' literal-navigated to a
 * page called "the end", accidental-close reports ('消しちゃった',
 * '間違えて閉じた', 'take it back') got no reopen, and hear-repairs
 * ('えっ', 'huh', 'pardon', 'come again') got NO-MATCH.
 */

let VoiceCommands;
try { VoiceCommands = require('../src/vr/input/VoiceCommands').VoiceCommands; }
catch { VoiceCommands = null; }

function makeVC() {
  const spoken = [];
  const tm = {
    tabs: [
      { id: 'a', currentUrl: 'https://news.jp', currentTitle: 'ニュース', pinned: false },
      { id: 'b', currentUrl: 'https://weather.jp', currentTitle: '天気', pinned: false },
      { id: 'c', currentUrl: 'https://diary.jp', currentTitle: '日記', pinned: false },
    ],
    activeIndex: 2,
    setActive: jest.fn(function (i) { this.activeIndex = i; }),
    getActiveTab: jest.fn(function () { return this.tabs[this.activeIndex]; }),
    closeTab: jest.fn(function (i) { return !this.tabs[i].pinned; }),
    reopenClosedTab: jest.fn(() => 'https://news.jp'),
    newTab: jest.fn(() => ({ id: 'new' })),
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.onGoTo = jest.fn();
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  vc._tm = tm;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);
const key = (vc) => vc.lastCommand?.key;
const last = (vc) => vc._spoken[vc._spoken.length - 1] || '';

describe('tab-relative (N個前/後・最後からN番目)', () => {
  test.each([
    ['二個前のタブ', 0], ['2個前のタブ', 0], ['一個前のタブ', 1],
    ['最後から二番目', 1], ['最後から2番目', 1], ['後ろから2番目', 1],
    ['最後から三番目', 0], ['second from the end', 1], ['third from the end', 0],
    ['2 from the end', 1],
  ])('"%s" switches to index %i', (p, idx) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('tab-relative');
    expect(vc._tm.setActive).toHaveBeenCalledWith(idx);
    expect(vc._tm.activeIndex).toBe(idx);
  });
  test('out-of-range position is an honest refusal, not a search', () => {
    const vc = makeVC();
    vc._tm.activeIndex = 0;
    run(vc, '2個前のタブ');
    expect(key(vc)).toBe('tab-relative');
    expect(last(vc)).toContain('その位置のタブはありません');
    expect(vc._tm.setActive).not.toHaveBeenCalled();
  });
});

describe('accidental-close → reopen', () => {
  test.each(['消しちゃった', 'タブを消しちゃった', '閉じちゃった', '消えちゃった',
    '間違えて閉じた', '間違えて消した', '間違えて閉じちゃった',
    'さっき閉じたタブ', 'さっき閉じたページ', '戻して', '復活させて',
    'タブを復元して', '復元して', 'take it back', 'take that back'])(
    '"%s" reopens the last closed tab', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('reopen-tab');
      expect(vc._tm.reopenClosedTab).toHaveBeenCalled();
    });
});

describe('hear-repair → say-again', () => {
  test.each(['えっ', '何て', 'なんて', 'huh', 'what', 'pardon', 'come again',
    'excuse me', 'repeat yourself'])(
    '"%s" replays the last spoken line', (p) => {
      const vc = makeVC();
      vc._lastSpoken = '直前の発話';
      run(vc, p);
      expect(key(vc)).toBe('say-again');
      expect(last(vc)).toBe('直前の発話');
    });
});

describe('scroll/resume alias coverage', () => {
  test.each(['go to the end', 'the end', 'all the way down', 'way down',
    'scroll all the way down'])('"%s" scrolls to bottom (not navigate)', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('scroll-bottom');
    expect(vc.onGoTo).not.toHaveBeenCalled();
  });
  test.each(['all the way up', 'way up', 'scroll all the way up'])(
    '"%s" scrolls to top', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('scroll-top');
    });
  test.each(['read on', 'carry on', 'keep going', 'keep reading'])(
    '"%s" resumes narration', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('resume-reading');
    });
  test('"go to google" still navigates', () => {
    const vc = makeVC();
    run(vc, 'go to google');
    expect(key(vc)).toBe('go-to');
    expect(vc.onGoTo).toHaveBeenCalledWith('google');
  });
});

describe('misc alias coverage', () => {
  test('"もう一度閉じて" closes (prefix strip), bare "もう一度" stays say-again', () => {
    const vc = makeVC();
    run(vc, 'もう一度閉じて');
    expect(key(vc)).toBe('close-tab');
    expect(vc._tm.closeTab).toHaveBeenCalledWith(2);
    run(vc, 'もう一度');
    expect(key(vc)).toBe('say-again');
  });
  test.each([['さっきより早く', 'speech-faster'], ['聞こえますか', 'mic-status'],
    ['なんで動かない', 'trouble'], ['大きい声で', 'volume-up'],
    ['声を出して', 'volume-up']])('"%s" → %s', (p, k) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe(k);
  });
});

describe('coexistence guards', () => {
  test('"ニュースのタブ" still switches by name', () => {
    const vc = makeVC();
    run(vc, 'ニュースのタブ');
    expect(key(vc)).toBe('tab-by-name');
    expect(vc._tm.activeIndex).toBe(0);
  });
  test('"前のタブ"/"最後のタブ" stay on their commands', () => {
    const vc = makeVC();
    run(vc, '前のタブ');
    expect(key(vc)).toBe('prev-tab');
    run(vc, '最後のタブ');
    expect(key(vc)).toBe('last-tab');
  });
  test('"閉じないで" still negates without closing', () => {
    const vc = makeVC();
    run(vc, '閉じないで');
    expect(key(vc)).toBe('negate');
    expect(vc._tm.closeTab).not.toHaveBeenCalled();
  });
});
