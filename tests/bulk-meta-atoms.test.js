/**
 * Bulk/meta atoms (round 70).
 *
 * Probe-driven: 'どのタブが音出てる' and 'どのタブか忘れた' were swallowed by
 * tab-by-name ('「ど」のタブがありません'), 'タブを全部ピン留め' had no
 * pin-all twin, '音量ゼロ'/'最大音量' needed named-set branches, and
 * author/date/conditional asks got NO-MATCH instead of honest answers.
 */

let VoiceCommands;
try { VoiceCommands = require('../src/vr/input/VoiceCommands').VoiceCommands; }
catch { VoiceCommands = null; }

function makeVC() {
  const spoken = [];
  const tm = {
    tabs: [
      { id: 'a', currentUrl: 'https://news.jp', currentTitle: 'ニュース', pinned: false },
      { id: 'b', currentUrl: 'https://weather.jp', currentTitle: '天気', pinned: true },
      { id: 'c', currentUrl: 'https://diary.jp', currentTitle: '日記', pinned: false },
    ],
    activeIndex: 1,
    setActive: jest.fn(function (i) { this.activeIndex = i; }),
    getActiveTab: jest.fn(function () { return this.tabs[this.activeIndex]; }),
    closeTab: jest.fn(function (i) { return !this.tabs[i].pinned; }),
    togglePin: jest.fn(function (i) {
      this.tabs[i].pinned = !this.tabs[i].pinned;
      return this.tabs[i].pinned ? 'pinned' : 'unpinned';
    }),
    duplicateTab: jest.fn(),
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

describe('honest-absence atoms (misroute fixes)', () => {
  test.each(['どのタブが音出てる', '音が出てるタブ', '音が鳴ってるタブ',
    'どのタブが鳴ってる', 'which tab is playing', 'what tab is playing'])(
    '"%s" answers honestly without searching a title', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('tab-audio');
      expect(last(vc)).toContain('検出できません');
      expect(vc._tm.setActive).not.toHaveBeenCalled();
    });
  test.each(['誰が書いた', '著者は誰', '作者は誰', 'いつの記事', '何年の記事',
    '公開日は', 'who wrote this', 'when was this published'])(
    '"%s" explains metadata is unavailable', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('tab-meta');
      expect(last(vc)).toContain('読み取れません');
    });
  test.each(['読み終わったら閉じて', '通知が来たら教えて', 'シャッフルして',
    'ランダムに開いて', 'let me know when'])(
    '"%s" explains conditional commands are unavailable', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('conditional');
    });
});

describe('pin-all (unpin-all twin)', () => {
  test.each(['タブを全部ピン留め', '全部ピン留めして', 'すべてのタブをピン留め',
    'pin all tabs'])('"%s" pins every unpinned tab', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('pin-all');
    expect(vc._tm.togglePin).toHaveBeenCalledTimes(2); // two unpinned
    expect(last(vc)).toContain('2個のタブをピン留め');
    expect(vc._tm.tabs[0].pinned).toBe(true);
    expect(vc._tm.tabs[2].pinned).toBe(true);
  });
  test('all-pinned answer is honest', () => {
    const vc = makeVC();
    vc._tm.tabs.forEach((t) => { t.pinned = true; });
    run(vc, '全部ピン留め');
    expect(key(vc)).toBe('pin-all');
    expect(last(vc)).toContain('ピン留めできるタブはありません');
  });
});

describe('volume-set named targets', () => {
  test.each(['音量ゼロにして', '音量をゼロに', '最大音量で', '音量を最大に',
    'max volume', 'full volume'])('"%s" reaches volume-set', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('volume-set');
  });
  test('"音量を最大に" calls onVolume toward 100', () => {
    const vc = makeVC();
    vc._onVolumeStatus = () => 30;
    vc._onVolume = jest.fn();
    run(vc, '音量を最大に');
    expect(vc._onVolume).toHaveBeenCalledWith(0.7);
  });
  test('"音量ゼロ" calls onVolume toward 0', () => {
    const vc = makeVC();
    vc._onVolumeStatus = () => 30;
    vc._onVolume = jest.fn();
    run(vc, '音量ゼロにして');
    expect(vc._onVolume).toHaveBeenCalledWith(-0.3);
  });
});

describe('duplicate/new/where/misc aliases', () => {
  test.each(['このタブを複製', '同じタブを開いて', 'もうひとつ開いて',
    'もう一つ開いて', '同じのをもう一つ'])('"%s" duplicates the tab', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('duplicate-tab');
    expect(vc._tm.duplicateTab).toHaveBeenCalled();
  });
  test.each(['新しいタブをもう一つ', 'another tab'])('"%s" opens new tab', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('new-tab');
    expect(vc._tm.newTab).toHaveBeenCalled();
  });
  test.each([
    ['どのタブか忘れた', 'describe-tab'], ['今どのタブ', 'where-am-i'],
    ['ズーム率は', 'reader-scale-status'], ['今の速さは', 'speech-rate-status'],
    ['あと何ページ', 'reader-progress'], ['このページについて', 'describe-tab'],
    ['ページを拡大して', 'reader-size-up'], ['リーダーを閉じて', 'reader-mode'],
    ['元のページに戻して', 'reader-mode'], ['さっきのサイト', 'back'],
    ['PDFに保存', 'print'], ['スクショして', 'screenshot'],
    ['タブが多すぎる', 'tabs-list'], ['近くに寄せて', 'panel-distance'],
  ])('"%s" → %s', (p, k) => {
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
    expect(vc._tm.setActive).toHaveBeenCalledWith(0);
  });
  test('"ピン留めを外して" still unpins the active tab', () => {
    const vc = makeVC();
    run(vc, 'ピン留めを外して');
    expect(key(vc)).toBe('unpin-active');
  });
  test('"閉じないで" still negates without closing', () => {
    const vc = makeVC();
    run(vc, '閉じないで');
    expect(key(vc)).toBe('negate');
    expect(vc._tm.closeTab).not.toHaveBeenCalled();
  });
  test('"ピンを全部外して" still unpins all (not pin-all)', () => {
    const vc = makeVC();
    run(vc, 'ピンを全部外して');
    expect(key(vc)).toBe('unpin-all');
    expect(last(vc)).toContain('ピンを外しました');
  });
});
