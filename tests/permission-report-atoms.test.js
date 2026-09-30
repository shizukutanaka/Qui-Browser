/**
 * Permission/report atoms — JA permission tails (ても構わない/よろしい/差し支えない
 * → execute like てもいいですか), neg-obligation いけない/ダメ cluster, stem+んか,
 * greetings→ack, fault questions→trouble, EN permission questions→help
 * (could/should/shall/is-it-ok), 'open devtools/downloads' go-to misroute fixes,
 * devtools honest atom, bookmark/resume/repeat/exit fills (pass LVII).
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeTabs(titles) {
  const tm = {
    tabs: titles.map((t) => ({ title: t })),
    activeIndex: 0,
    getActiveTab() { return this.tabs[this.activeIndex]; },
    closeTab() {}, setActive(i) { this.activeIndex = i; }, closeTabs() {},
  };
  return tm;
}

function boot(titles) {
  const vc = new VoiceCommands({ enabled: true });
  vc.connectBrowser({ tabManager: makeTabs(titles), onGoTo: () => {} });
  return vc;
}

function run(vc, p) {
  vc.lastCommand = null;
  vc.processCommand(p);
  return vc.lastCommand;
}

describe('JA permission tails execute (parallel to てもいいですか)', () => {
  const vc = boot(['A', 'B', 'C']);
  const cases = [
    ['閉じても構いません', 'close-tab'], ['閉じてもよろしい', 'close-tab'],
    ['閉じて差し支えない', 'close-tab'], ['閉じてもよいでしょうか', 'close-tab'],
    ['閉じてもよろしいでしょうか', 'close-tab'], ['閉じてええよ', 'close-tab'],
    ['閉じてええで', 'close-tab'], ['閉じてくださいますか', 'close-tab'],
    ['閉じてくださいます', 'close-tab'], ['閉じてくれぬか', 'close-tab'],
    ['閉じてくれへんの', 'close-tab'], ['閉じてほしいの', 'close-tab'],
    ['閉じてほしいわ', 'close-tab'], ['読んでほしいの', 'read-aloud'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA neg-obligation & misc tails execute', () => {
  const vc = boot(['A', 'B', 'C']);
  const cases = [
    ['閉じないとダメ', 'close-tab'], ['閉じなきゃいけない', 'close-tab'],
    ['閉じないといけない', 'close-tab'], ['閉じなければいけない', 'close-tab'],
    ['読まなきゃいけない', 'read-aloud'], ['戻らないとダメ', 'back'],
    ['閉じんか', 'close-tab'], ['読まんか', 'read-aloud'],
    ['閉じるのがいい', 'close-tab'], ['閉じるのはどう', 'close-tab'],
    ['読むのがよい', 'read-aloud'], ['戻るのがいい', 'back'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA fault questions → trouble', () => {
  const vc = boot(['A', 'B']);
  const cases = [
    ['なんで閉じないの', 'trouble'], ['どうして閉じない', 'trouble'],
    ['どうして開かない', 'trouble'], ['閉じないんだけど', 'trouble'],
    ['開かないんだけど', 'trouble'], ['なんで閉じない', 'trouble'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA greetings & reaction fills → ack', () => {
  const vc = boot(['A', 'B']);
  const cases = [
    ['おはよう', 'ack'], ['おはようございます', 'ack'], ['こんにちは', 'ack'],
    ['こんばんは', 'ack'], ['はじめまして', 'ack'], ['元気', 'ack'],
    ['ひさしぶり', 'ack'], ['お疲れ様です', 'ack'],
    ['そういうこと', 'ack'], ['そういうことか', 'ack'],
    ['そうだったのか', 'ack'], ['いいの', 'ack'], ['いいかな', 'ack'],
    ['いいかしら', 'ack'], ['ラジャー', 'ack'], ['オッケーです', 'ack'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA reader progress & read requests', () => {
  const vc = boot(['A', 'B']);
  const cases = [
    ['あと半分', 'reader-progress'], ['あと一ページ', 'reader-progress'],
    ['残りあと少し', 'reader-progress'], ['あとちょっと', 'remaining-time'],
    ['もう読んだ', 'reader-progress'], ['読書中', 'reader-progress'],
    ['その続き', 'read-here'], ['途中から読んで', 'read-here'],
    ['キャッシュを消して', 'privacy-clean'], ['Cookie消して', 'privacy-clean'],
    ['クッキー消して', 'privacy-clean'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('EN permission questions → help (no execution)', () => {
  const vc = boot(['A', 'B', 'C']);
  const cases = [
    ['could i close it', 'help'], ['should i close it', 'help'],
    ['shall i close it', 'help'], ['is it ok to close it', 'help'],
    ['is it okay to close it', 'help'], ['could i go back', 'help'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('EN politeness frames still execute', () => {
  const vc = boot(['A', 'B', 'C']);
  const cases = [
    ['would you mind awfully closing it', 'close-tab'],
    ['would you mind terribly closing it', 'close-tab'],
    ['be a dear and close it', 'close-tab'],
    ['i beg you to close it', 'close-tab'],
    ['for the love of god close it', 'close-tab'],
    ['pretty please with a cherry on top close it', 'close-tab'],
    ['nuke it', 'close-tab'], ['ax it', 'close-tab'], ['put it away', 'close-tab'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('EN fault questions & frustration → trouble', () => {
  const vc = boot(['A', 'B']);
  const cases = [
    ['why wont you close it', 'trouble'], ['why didnt it close', 'trouble'],
    ['why isnt it closing', 'trouble'], ['why cant it load', 'trouble'],
    ['screw this', 'trouble'], ['grr', 'trouble'], ['bleh', 'trouble'],
    ['gosh darn', 'trouble'], ['dang it', 'trouble'], ['dammit', 'trouble'],
    ['son of a gun', 'trouble'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('EN greetings, ack fills & negate extras', () => {
  const vc = boot(['A', 'B']);
  const cases = [
    ['good morning', 'ack'], ['good evening', 'ack'], ['howdy', 'ack'],
    ['hey there', 'ack'], ['hi there', 'ack'], ['hello there', 'ack'],
    ['hey', 'ack'], ['how we doing', 'ack'], ['cool beans', 'ack'],
    ['much obliged', 'ack'], ['thanks a million', 'ack'], ['appreciated', 'ack'],
    ['cheers mate', 'ack'], ['youre welcome', 'ack'], ['sorry', 'ack'],
    ['oopsie', 'ack'], ['whoopsie', 'ack'], ['my dude', 'ack'],
    ['seriously', 'ack'], ['for real', 'ack'], ['fr fr', 'ack'],
    ['alright then', 'ack'], ['fine', 'ack'], ['chill', 'ack'],
    ['go on then', 'ack'], ['go right ahead', 'ack'],
    ['ta', 'ack'], ['np', 'ack'], ['yw', 'ack'], ['rad', 'ack'],
    ['epic', 'ack'], ['legendary', 'ack'], ['bro', 'ack'], ['dude', 'ack'],
    ['no shot', 'negate'], ['no sir', 'negate'], ['not today', 'negate'],
    ['not happening', 'negate'], ['over my dead body', 'negate'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('EN honest atoms, misroute fixes & fills', () => {
  const vc = boot(['A', 'B']);
  const cases = [
    ['open devtools', 'devtools'], ['view source', 'devtools'],
    ['inspect element', 'devtools'], ['developer tools', 'devtools'],
    ['デベロッパーツール', 'devtools'], ['ソースを見る', 'devtools'],
    ['open my downloads', 'download'], ['open the downloads', 'download'],
    ['export bookmarks', 'download'], ['import bookmarks', 'download'],
    ['clear my cache', 'privacy-clean'], ['clear my cookies', 'privacy-clean'],
    ['sign me out', 'account'], ['アンインストール', 'device-apps'],
    ['ホーム画面に追加', 'device-apps'], ['add to home screen', 'device-apps'],
    ['capture this', 'screenshot'], ['capture the page', 'screenshot'],
    ['bookmark it', 'bookmark-page'], ['remember this', 'bookmark-page'],
    ['remember that', 'bookmark-page'], ['stash it', 'bookmark-page'],
    ['save this for later', 'bookmark-page'],
    ['where was i', 'resume-reading'], ['lost my place', 'resume-reading'],
    ['losing my place', 'resume-reading'], ['i lost my place', 'resume-reading'],
    ['do over', 'repeat-command'], ['do it over', 'repeat-command'],
    ['read it to me', 'read-aloud'], ['read this to me', 'read-aloud'],
    ['read the whole thing', 'read-aloud'],
    ['bigger please', 'reader-size-up'], ['larger text', 'reader-size-up'],
    ['smaller please', 'reader-size-down'], ['smaller text', 'reader-size-down'],
    ['emergency stop', 'stop-everything'], ['abort', 'stop-everything'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('coexistence — established routes preserved', () => {
  const vc = boot(['A', 'B', 'C']);
  const cases = [
    ['閉じていいですか', 'close-tab'], ['閉じてもいいですか', 'close-tab'],
    ['閉じてもらっていい', 'close-tab'], ['can i close it now', 'help'],
    ['may i close it', 'close-tab'], ['mind if i close it', 'help'],
    ['閉じなくちゃ', 'close-tab'], ['閉じて', 'close-tab'],
    ['閉じちゃったよ', 'reopen-tab'], ['go ahead', 'ack'],
    ['open up a tab', 'new-tab'], ['whats it say', 'read-aloud'],
    ['excuse me', 'say-again'], ['pardon', 'say-again'],
    ['ugh', 'trouble'], ['meh', 'ack'], ['one more time', 'repeat-command'],
    ['from the top', 'read-aloud'], ['night mode', 'dark-mode'],
    ['print this', 'print'], ['sign out', 'account'],
    ['open my mail', 'device-apps'], ['戻れない', 'back-status'],
    ['閉じても構わないと言った', 'close-tab'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});
