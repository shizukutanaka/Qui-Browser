/**
 * R84 — Readback/lookup atoms (pass XXXVIII).
 * Probe (~80 phrases): '今の音量を教えて' fell through volume-status's exact
 * literals into web-search (searched for '音量'), '読み直して' replayed the
 * last spoken line via say-again instead of re-reading the page, and
 * '左側のタブ'/'もっと左のタブ'/'真ん中のタブ' were searched as tab titles.
 */
const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;

function makeVC() {
  const vc = new VC({ enabled: true });
  const tm = {
    tabs: [
      { currentTitle: 'Inbox — mail', currentUrl: 'https://mail.example.com', pinned: false },
      { currentTitle: 'News', currentUrl: 'https://news.example.com', pinned: false },
      { currentTitle: 'Docs', currentUrl: 'https://docs.example.com', pinned: false }
    ],
    activeIndex: 0,
    getActiveTab() {
      return this.tabs[this.activeIndex];
    },
    setActive: jest.fn(function (i) {
      this.activeIndex = i;
    }),
    nextTab: jest.fn(),
    prevTab: jest.fn(),
    closeTab: jest.fn(() => true)
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.tm = tm;
  vc.said = [];
  vc.speak = (s) => vc.said.push(s);
  vc.readAloud = jest.fn();
  return vc;
}
const run = (vc, p) => {
  vc.lastCommand = null;
  vc.processCommand(p);
  return vc.lastCommand ? vc.lastCommand.key : null;
};

describe('volume readback misroute + queries', () => {
  test.each(['今の音量を教えて', '音量を確認', '音量を確認して', '声の大きさ', '音量はどのくらい'])(
    '%s → volume-status (not web-search)', (p) => {
      const vc = makeVC();
      vc._onVolumeStatus = () => 60;
      expect(run(vc, p)).toBe('volume-status');
      expect(vc.said[0]).toContain('60%');
    }
  );

  test.each(['音量を変えて', '音量を変更して', '音量を変更'])(
    'bare change request %s → volume-status prompt (never zeroes volume)', (p) => {
      const vc = makeVC();
      vc._onVolumeStatus = () => 60;
      vc._onVolumeSet = jest.fn();
      expect(run(vc, p)).toBe('volume-status');
      expect(vc._onVolumeSet).not.toHaveBeenCalled();
    }
  );

  test('音量を教えて unchanged', () => {
    const vc = makeVC();
    vc._onVolumeStatus = () => 30;
    expect(run(vc, '音量を教えて')).toBe('volume-status');
    expect(vc.said[0]).toContain('30%');
  });
});

describe('reread forms → read-aloud (not say-again)', () => {
  test.each(['読み直して', 'もう一度読み直して', '頭から読み直して', 'やり直して読んで', '読みたい', '読んでほしい'])(
    '%s → read-aloud', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('read-aloud');
      expect(vc.readAloud).toHaveBeenCalled();
    }
  );

  test('もう一度 → say-again unchanged', () => {
    const vc = makeVC();
    vc._lastSpoken = 'prev';
    expect(run(vc, 'もう一度')).toBe('say-again');
    expect(vc.readAloud).not.toHaveBeenCalled();
  });
});

describe('tab positional side-forms', () => {
  test.each(['左側のタブ', 'もっと左のタブ', '左側のタブに'])('%s → prev-tab', (p) => {
    const vc = makeVC();
    expect(run(vc, p)).toBe('prev-tab');
    expect(vc.tm.prevTab).toHaveBeenCalled();
  });

  test.each(['右側のタブ', 'もっと右のタブ', '右側のタブに'])('%s → next-tab', (p) => {
    const vc = makeVC();
    expect(run(vc, p)).toBe('next-tab');
    expect(vc.tm.nextTab).toHaveBeenCalled();
  });

  test('真ん中のタブ → honest miss (no title search for 真ん中)', () => {
    const vc = makeVC();
    run(vc, '真ん中のタブ');
    expect(vc.lastCommand?.key ?? null).toBeNull();
  });

  test.each(['最初のやつ', '先頭のやつ', '最初の方のタブ'])('%s → first-tab', (p) => {
    const vc = makeVC();
    expect(run(vc, p)).toBe('first-tab');
    expect(vc.tm.setActive).toHaveBeenCalledWith(0);
  });

  test.each(['最後のやつ', '末尾のやつ', '最後の方のタブ'])('%s → last-tab', (p) => {
    const vc = makeVC();
    expect(run(vc, p)).toBe('last-tab');
    expect(vc.tm.setActive).toHaveBeenCalledWith(2);
  });

  test('最初のタブ / 最後のタブ unchanged', () => {
    const vc = makeVC();
    expect(run(vc, '最初のタブ')).toBe('first-tab');
    expect(vc.tm.setActive).toHaveBeenLastCalledWith(0);
    expect(run(vc, '最後のタブ')).toBe('last-tab');
    expect(vc.tm.setActive).toHaveBeenLastCalledWith(2);
  });
});

describe('lost-user help forms', () => {
  test.each(['わからん', '使い方がわからん', '使い方教えて', 'どうするの', 'これどうする', '操作がわからない', 'どうする', 'どうすればいいの', '何をすればいい'])(
    '%s → help', (p) => {
      expect(run(makeVC(), p)).toBe('help');
    }
  );
});

describe('ack praise/thanks extension', () => {
  test.each(['thank you so much', 'thanks a lot', 'thx', '助かった', 'たすかった', '助かる'])(
    '%s → ack (thanks line)', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('ack');
    }
  );

  test.each(['かっこいい', 'すごい', 'いいね', '素晴らしい', '最高', 'すばらしい', 'awesome', 'great', 'perfect', 'nice'])(
    '%s → ack (praise gets ありがとうございます)', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('ack');
      expect(vc.said[0]).toBe('ありがとうございます');
    }
  );

  test('ありがとう → どういたしまして (unchanged)', () => {
    const vc = makeVC();
    expect(run(vc, 'ありがとう')).toBe('ack');
    expect(vc.said[0]).toBe('どういたしまして');
  });

  test('わかった → 承知しました (unchanged)', () => {
    const vc = makeVC();
    expect(run(vc, 'わかった')).toBe('ack');
    expect(vc.said[0]).toBe('承知しました');
  });
});

describe('web-search topic/bare fills', () => {
  test.each(['天気は', '今週の天気', '天気', '気温は', '湿度は', '雨降る', 'ニュースがある', 'ニュース読んで', 'ニュースを聞かせて', 'ニュース検索'])(
    '%s → web-search', (p) => {
      expect(run(makeVC(), p)).toBe('web-search');
    }
  );

  test.each(['調べて', '調べたい', '調べもの', '検索させて', 'google で検索して', '調べてほしい'])(
    '%s → web-search (prompts when no term)', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('web-search');
      expect(vc.said[0]).toBe('検索語がありません');
    }
  );

  test('グーグルで検索 → search-engine (engine-switch convention, R65)', () => {
    expect(run(makeVC(), 'グーグルで検索')).toBe('search-engine');
  });

  test('今日の天気 unchanged', () => {
    const vc = makeVC();
    expect(run(vc, '今日の天気')).toBe('web-search');
    expect(vc.said[0]).toContain('今日の天気');
  });
});

describe('misc fills', () => {
  test('文字を変えて → text-style honest atom', () => {
    expect(run(makeVC(), '文字を変えて')).toBe('text-style');
  });

  test.each(['読みやすくして', '見やすくして'])('%s → reader-size-up', (p) => {
    expect(run(makeVC(), p)).toBe('reader-size-up');
  });

  test.each(['眠い', '頭痛い', '頭が痛い', 'めまい', 'ふらつく'])('%s → trouble', (p) => {
    expect(run(makeVC(), p)).toBe('trouble');
  });
});

describe('coexistence guards', () => {
  test("'tab named news' still title-searches", () => {
    const vc = makeVC();
    expect(run(vc, 'tab named news')).toBe('tab-by-name');
    expect(vc.tm.setActive).toHaveBeenCalledWith(1);
  });

  test('読んで → read-aloud unchanged', () => {
    const vc = makeVC();
    expect(run(vc, '読んで')).toBe('read-aloud');
  });

  test('ニュースを見せて → web-search unchanged', () => {
    const vc = makeVC();
    expect(run(vc, 'ニュースを見せて')).toBe('web-search');
    expect(vc.said[0]).toContain('ニュース');
  });
});
