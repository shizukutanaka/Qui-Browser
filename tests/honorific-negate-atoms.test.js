/**
 * R89 — honorific/prohibition atoms (pass XLIII).
 * Probe (~120 phrases): お〜ください honorifics, dict+な prohibition
 * ('閉じるな' navigated back!), masu-stem+な casual imperative, なさい tail,
 * ておいて/てごらん/てして, EN 'would you mind ~ing', hyper-polite wraps,
 * 'is it ~' status questions, me-constructions were NO-MATCH or misrouted.
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
    closeTab: () => true,
    closeAllTabs() {
      return this.tabs.length;
    }
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.tm = tm;
  vc.said = [];
  vc.speak = (s) => vc.said.push(s);
  return vc;
}
const run = (vc, p) => {
  vc.lastCommand = null;
  vc.processCommand(p);
  return vc.lastCommand ? vc.lastCommand.key : null;
};

describe('お〜ください honorific requests', () => {
  test.each([
    ['お読みください', 'read-aloud'],
    ['お戻りください', 'back'],
    ['お進みください', 'navigate'],
    ['お待ちください', 'pause-reading'],
    ['お閉じください', 'close-tab']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('dict+な prohibition → negate (not execution!)', () => {
  test.each(['読むな', '閉じるな', '戻るな', '進むな', '消すな', 'やめるな', '止めるな'])('%s → negate', (p) => {
    expect(run(makeVC(), p)).toBe('negate');
  });
});

describe('masu-stem+な casual imperative', () => {
  test.each([
    ['閉じな', 'close-tab'],
    ['読みな', 'read-aloud'],
    ['戻りな', 'back'],
    ['進みな', 'navigate'],
    ['見な', 'describe-tab'],
    ['聞きな', 'say-again'],
    ['やめな', 'stop'],
    ['待ちな', 'pause-reading']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('なさい + tail / ておいて / てごらん / てして', () => {
  test.each([
    ['読みなさいよ', 'read-aloud'],
    ['閉じなさいな', 'close-tab'],
    ['閉じておいて', 'close-tab'],
    ['戻っておいて', 'back'],
    ['消しておいて', 'dismiss-notify'],
    ['閉じてして', 'close-tab'],
    ['読んでして', 'read-aloud'],
    ['読んでごらん', 'read-aloud'],
    ['閉じてごらん', 'close-tab']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN shut/turn/switch idioms', () => {
  test.each([
    ['shut it', 'close-tab'],
    ['shut it down', 'vr-exit'],
    ['turn it off', 'vr-exit'],
    ['turn down the volume', 'volume-down'],
    ['turn up the volume', 'volume-up'],
    ['crank it down', 'volume-down'],
    ['pump it up', 'volume-up']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN hyper-polite wraps', () => {
  test.each([
    ['if you please go back', 'back'],
    ['close this pretty please', 'close-tab'],
    ['be so kind as to close this', 'close-tab'],
    ['would you mind closing', 'close-tab'],
    ['mind closing this', 'close-tab'],
    ['mind going back', 'back']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('is-it status questions', () => {
  test.each([
    ['is it loud', 'volume-status'],
    ['is it quiet', 'mute-status'],
    ['is it paused', 'working-status'],
    ['is it playing', 'video-status'],
    ['is it recording', 'video-status'],
    ['is it dark', 'brightness'],
    ['is it bright', 'brightness'],
    ['is it ready', 'working-status']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('me-constructions', () => {
  test.each([
    ['tell me again', 'say-again'],
    ['tell me what it says', 'read-aloud'],
    ['tell me the title', 'describe-tab'],
    ['read me the page', 'read-aloud'],
    ['show me again', 'say-again'],
    ['give me the tabs', 'tabs-list'],
    ['list em for me', 'tabs-list']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('EN negations → negate', () => {
  test.each(['dont read it', 'dont close it', 'dont stop', 'dont go back', 'never close it', 'dont touch it'])(
    '%s → negate', (p) => {
      expect(run(makeVC(), p)).toBe('negate');
    }
  );
});

describe('make-it forms', () => {
  test.each([
    ['make it louder', 'volume-up'],
    ['make it quieter', 'volume-down'],
    ['make it faster', 'speech-faster'],
    ['make it slower', 'speech-slower']
  ])('%s → %s', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});

describe('coexistence guards', () => {
  test.each([
    ['読んで', 'read-aloud'],
    ['閉じて', 'close-tab'],
    ['戻って', 'back'],
    ['戻る', 'back'],
    ['進む', 'navigate'],
    ['進んで', 'navigate'],
    ['進め', 'navigate'],
    ['please go back', 'back'],
    ['can you go back', 'back'],
    ['go to google', 'go-to'],
    ['open the news tab', 'tab-by-name']
  ])('%s → %s unchanged', (p, key) => {
    expect(run(makeVC(), p)).toBe(key);
  });
});
