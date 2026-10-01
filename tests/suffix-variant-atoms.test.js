/**
 * R86 — JA suffix-variant & misc atoms (pass XL).
 * Probe (~90 phrases): ~てみる/~てしまう/~ちゃう/~てあげて/~てもらう verb suffixes
 * were all NO-MATCH (the polite retry layer only covered request/keigo tails),
 * plus bare rate/volume words and EN where/who/when questions.
 */
const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;

function makeVC() {
  const vc = new VC({ enabled: true });
  const tm = {
    tabs: [
      { currentTitle: 'Inbox', currentUrl: 'https://mail.example.com', pinned: false },
      { currentTitle: 'News', currentUrl: 'https://news.example.com', pinned: false }
    ],
    activeIndex: 0,
    getActiveTab() {
      return this.tabs[this.activeIndex];
    },
    setActive(i) {
      this.activeIndex = i;
    },
    nextTab() {},
    prevTab() {},
    closeTab: () => true
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

describe('~てみる trial suffix', () => {
  test.each([
    ['戻ってみる', 'back'],
    ['進んでみる', 'navigate'],
    ['閉じてみる', 'close-tab'],
    ['読んでみる', 'read-aloud'],
    ['検索してみる', 'find-in-page'],
    ['聞いてみる', 'say-again']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('~ちゃう/~てしまう contraction suffixes', () => {
  test.each([
    ['閉じちゃう', 'close-tab'],
    ['消しちゃう', 'dismiss-notify'],
    ['閉じてしまう', 'close-tab'],
    ['読んでしまう', 'read-aloud']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });

  test.each(['閉じちゃった', '消えちゃった'])('%s → reopen-tab (accident-report, raw wins)', (p) => {
    expect(run(makeVC(), p)).toBe('reopen-tab');
  });
});

describe('~てあげて/~てもらう humble request suffixes', () => {
  test.each([
    ['読んであげて', 'read-aloud'],
    ['読んでもらえる', 'read-aloud'],
    ['読んでもらう', 'read-aloud'],
    ['閉じてもらえる', 'close-tab'],
    ['教えてもらえる', 'help']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN where/who/when question fills', () => {
  test.each(['where are we', 'where is this', 'whats this site', 'whats the site', 'whats this tab'])(
    '%s → where-am-i', (p) => {
      expect(run(makeVC(), p)).toBe('where-am-i');
    }
  );

  test.each(['who is this', 'when was this', 'when was it'])(
    '%s → tab-meta', (p) => {
      expect(run(makeVC(), p)).toBe('tab-meta');
    }
  );

  test("who made this → about (the app's author)", () => {
    expect(run(makeVC(), 'who made this')).toBe('about');
  });

  test.each(['what does this say', 'what does it say', "what's it say"])(
    '%s → read-aloud', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('read-aloud');
      expect(vc.readAloud).toHaveBeenCalled();
    }
  );
});

describe('scroll/read misc fills', () => {
  test.each(['もうちょい上', 'もうちょい上へ', 'ぐいっと上'])('%s → scroll-up', (p) => {
    expect(run(makeVC(), p)).toBe('scroll-up');
  });

  test.each(['もうちょい下', 'もうちょい下へ', 'ぐいっと下', 'keep scrolling'])('%s → scroll-down', (p) => {
    expect(run(makeVC(), p)).toBe('scroll-down');
  });

  test.each(['どこ読んでた', '何読んでた', 'どこを読んでた'])('%s → line-status', (p) => {
    expect(run(makeVC(), p)).toBe('line-status');
  });

  test.each(['続きは', 'つづきは', '残りは', '次の部分', 'あとは'])('%s → read-here', (p) => {
    expect(run(makeVC(), p)).toBe('read-here');
  });

  test.each(['あと少し', 'あとちょっと', 'もう少しで終わる'])('%s → remaining-time', (p) => {
    expect(run(makeVC(), p)).toBe('remaining-time');
  });
});

describe('bare words + imperatives + pleas', () => {
  test.each([['早く', 'speech-faster'], ['速く', 'speech-faster'], ['遅く', 'speech-slower'], ['ゆっくりめ', 'speech-slower']])(
    '%s → %s', (p, key) => {
      expect(run(makeVC(), p)).toBe(key);
    }
  );

  test('ボリューム → volume-status', () => {
    const vc = makeVC();
    vc._onVolumeStatus = () => 50;
    expect(run(vc, 'ボリューム')).toBe('volume-status');
    expect(vc.said[0]).toContain('50%');
  });

  test.each(['止めろ', 'やめろ', '止めなさい'])('%s → stop-everything', (p) => {
    expect(run(makeVC(), p)).toBe('stop-everything');
  });

  test.each(['探せ', '探してみて'])('%s → find-in-page', (p) => {
    expect(run(makeVC(), p)).toBe('find-in-page');
  });

  test.each(['調べろ', '調べなさい'])('%s → web-search prompt', (p) => {
    const vc = makeVC();
    expect(run(vc, p)).toBe('web-search');
    expect(vc.said[0]).toBe('検索語がありません');
  });

  test.each(['お願い', 'おねがい', '頼む', '頼みます', 'please do', 'pls help', 'help me out'])(
    '%s → help', (p) => {
      expect(run(makeVC(), p)).toBe('help');
    }
  );

  test.each(['置いといて', '置いとく', '置いておいて', 'このまま', 'このままで'])('%s → negate', (p) => {
    expect(run(makeVC(), p)).toBe('negate');
  });

  test('送って / 送っちゃって → share-page', () => {
    expect(run(makeVC(), '送って')).toBe('share-page');
    expect(run(makeVC(), '送っちゃって')).toBe('share-page');
  });
});

describe('coexistence guards', () => {
  test.each([
    ['探して', 'find-in-page'],
    ['調べて', 'web-search'],
    ['読んで', 'read-aloud'],
    ['戻って', 'back'],
    ['続きを読んで', 'read-here'],
    ['もう一度読み直して', 'read-aloud']
  ])('%s → %s unchanged', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});
