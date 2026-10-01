/**
 * R85 — Status-query & reaction atoms (pass XXXIX).
 * Probe (~90 phrases): progress/state questions ('再生中'/'読んでる最中'/
 * 'is it working'/'did it stop'), capability questions ('できる'/'can i'),
 * collection questions ('any notifications'/'any tabs open'), and social
 * reactions ('なるほど'/'ほんと') were NO-MATCH.
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

describe('in-progress status queries', () => {
  test.each(['読んでる最中', '読んでいる最中', '喋ってる', '喋ってますか', '読み上げています'])(
    '%s → speaking-status', (p) => {
      const vc = makeVC();
      vc.synthesis = { speaking: true };
      expect(run(vc, p)).toBe('speaking-status');
      expect(vc.said[0]).toBe('読み上げ中です');
    }
  );

  test.each(['再生中', '再生してる', '再生していますか', '再生中ですか', '何を再生中', '何が再生中', 'anything playing', 'something playing', "what's on"])(
    '%s → video-status', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('video-status');
      expect(vc.said[0]).toContain('動画');
    }
  );

  test.each(['ミュートになってる', 'ミュートされている', 'ミュートしてます'])('%s → mute-status', (p) => {
    expect(run(makeVC(), p)).toBe('mute-status');
  });

  test.each(['お気に入り登録してる', 'お気に入りに登録した', 'ブックマークに追加した', 'お気に入りに追加してる'])(
    '%s → bookmark-status', (p) => {
      expect(run(makeVC(), p)).toBe('bookmark-status');
    }
  );

  test.each(['聞こえます', '聞こえてます'])('%s → mic-status', (p) => {
    const vc = makeVC();
    vc.isListening = false;
    expect(run(vc, p)).toBe('mic-status');
    expect(vc.said[0]).toBe('マイクはオフです');
  });
});

describe('collection questions', () => {
  test.each(['any notifications', 'any new notifications'])('%s → read-notify', (p) => {
    expect(run(makeVC(), p)).toBe('read-notify');
  });

  test.each(['any tabs open', 'any tabs', 'are there tabs'])('%s → tab-status', (p) => {
    expect(run(makeVC(), p)).toBe('tab-status');
  });
});

describe('capability questions → help', () => {
  test.each(['what can i do', 'what do i say', 'how does this work', 'can i close this', 'can i skip it'])(
    '%s → help', (p) => {
      expect(run(makeVC(), p)).toBe('help');
    }
  );

  test.each(['できる', 'できない', 'できますか', '可能ですか', '対応してる', '対応してない', '対応してますか', 'できません', 'これできる'])(
    '%s → help', (p) => {
      expect(run(makeVC(), p)).toBe('help');
    }
  );

  test.each(['can i go back', 'can we go back'])('%s → back-status still wins', (p) => {
    expect(run(makeVC(), p)).toBe('back-status');
  });

  test('can i go forward → forward-status still wins', () => {
    expect(run(makeVC(), 'can i go forward')).toBe('forward-status');
  });
});

describe('working-status honest atom', () => {
  test.each(['is it working', 'is it on', 'is it done', 'did it work', 'did it stop',
    '動いてる', '動いてますか', '動作してる', 'ちゃんと動いてる',
    '止まってる', '止まってますか', '今止まってる', '固まってる'])(
    '%s → working-status', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('working-status');
      expect(vc.said[0]).toContain('音声認識は動作中');
    }
  );
});

describe('request-form + reaction fills', () => {
  test.each(['読んでくれる', '読んでくれない', '読んでおいて'])('%s → read-aloud', (p) => {
    const vc = makeVC();
    expect(run(vc, p)).toBe('read-aloud');
    expect(vc.readAloud).toHaveBeenCalled();
  });

  test.each(['なるほど', 'へー', 'ほんと', '本当ですか', 'まじか', 'うそ', 'そうなんだ', '確かに'])(
    '%s → ack', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('ack');
      expect(vc.said[0]).toBe('承知しました');
    }
  );
});

describe('coexistence guards', () => {
  test('読み上げ中 → line-status (owned literal)', () => {
    expect(run(makeVC(), '読み上げ中')).toBe('line-status');
  });

  test('再生位置 → video-status unchanged', () => {
    expect(run(makeVC(), '再生位置')).toBe('video-status');
  });

  test('ミュートしてる → mute-status unchanged', () => {
    expect(run(makeVC(), 'ミュートしてる')).toBe('mute-status');
  });

  test('mute → mute-toggle unchanged', () => {
    expect(run(makeVC(), 'mute')).toBe('mute-toggle');
  });

  test('戻れる → back-status unchanged', () => {
    expect(run(makeVC(), '戻れる')).toBe('back-status');
  });
});
