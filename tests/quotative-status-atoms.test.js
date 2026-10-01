const VC = require('/Users/devin/repos/Qui-Browser/src/vr/input/VoiceCommands').VoiceCommands;

function boot() {
  const vc = new VC({ enabled: true });
  const tm = {
    tabs: [{ title: 'A' }, { title: 'B' }],
    activeIndex: 0,
    getActiveTab() { return this.tabs[this.activeIndex]; },
    closeTab() {}, setActive(i) { this.activeIndex = i; },
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  return vc;
}

function hit(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase);
  return vc.lastCommand && vc.lastCommand.key;
}

describe('JA permission/honorific tails II (execute)', () => {
  const vc = boot();
  const cases = [
    ['閉じてもよろしいでしょうか', 'close-tab'],
    ['閉じてもいいんですか', 'close-tab'],
    ['閉じても大丈夫ですか', 'close-tab'],
    ['閉じてもらえませんか', 'close-tab'],
    ['閉じてもらえますでしょうか', 'close-tab'],
    ['閉じていただけますか', 'close-tab'],
    ['閉じていただきたいです', 'close-tab'],
    ['閉じていただきたいのですが', 'close-tab'],
    ['閉じていただけますでしょうか', 'close-tab'],
    ['閉じていただけないでしょうか', 'close-tab'],
    ['閉じていただくことはできますか', 'close-tab'],
    ['閉じていただけますと幸いです', 'close-tab'],
    ['閉じていただけるとありがたい', 'close-tab'],
    ['閉じていただけると助かります', 'close-tab'],
    ['閉じてくださると助かります', 'close-tab'],
    ['閉じてくれると助かる', 'close-tab'],
    ['閉じてくれたら助かる', 'close-tab'],
    ['閉じてくれればいい', 'close-tab'],
    ['閉じてくれさえすれば', 'close-tab'],
    ['閉じてさえくれれば', 'close-tab'],
    ['閉じさえしてくれれば', 'close-tab'],
    ['閉じさえすれば', 'close-tab'],
    ['閉じすればいい', 'close-tab'],
    ['閉じすらして', 'close-tab'],
    ['閉じたらどうです', 'close-tab'],
    ['閉じたらいかがですか', 'close-tab'],
    ['閉じたほうがいいんじゃない', 'close-tab'],
    ['閉じたほうがいいと思う', 'close-tab'],
    ['読んでもよろしいですか', 'read-aloud'],
    ['戻ってもいいんですか', 'back'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hit(vc, p)).toBe(key));
  }
});

describe('JA obligation tails II (execute)', () => {
  const vc = boot();
  const cases = [
    ['閉じないとまずい', 'close-tab'], ['閉じないと困る', 'close-tab'],
    ['閉じないとだめだ', 'close-tab'], ['閉じないとやばい', 'close-tab'],
    ['閉じないといけないんだ', 'close-tab'], ['閉じないといけないんです', 'close-tab'],
    ['閉じなくてはまずい', 'close-tab'],
    ['読まないと困る', 'read-aloud'], ['戻らないとまずい', 'back'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hit(vc, p)).toBe(key));
  }
});

describe('JA status questions & reports', () => {
  const vc = boot();
  const cases = [
    ['閉じれた', 'describe-tab'], ['閉じれたか', 'describe-tab'],
    ['閉じたか', 'describe-tab'], ['開いたか', 'describe-tab'],
    ['読み終わったか', 'reader-progress'], ['終わったか', 'reader-progress'],
    ['できたか', 'working-status'], ['できた', 'working-status'],
    ['保存できた', 'bookmark-status'], ['保存できたか', 'bookmark-status'],
    ['もういいのか', 'negate'],
    ['まだか', 'working-status'], ['まだですか', 'working-status'],
    ['まだ終わらない', 'working-status'], ['まだ読んでるの', 'reader-progress'],
    ['さっき閉じた', 'describe-tab'], ['もう閉じた', 'describe-tab'],
    ['既に閉じた', 'describe-tab'], ['閉じたって', 'describe-tab'],
    ['閉じたらしい', 'describe-tab'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hit(vc, p)).toBe(key));
  }
});

describe('JA fault statements → trouble', () => {
  const vc = boot();
  const cases = [
    ['閉じないんだが', 'trouble'], ['開かないんですが', 'trouble'],
    ['消えないんだが', 'trouble'], ['止まらないんだが', 'trouble'],
    ['進まないんだが', 'trouble'], ['閉じないから', 'trouble'],
    ['閉じないんだよ', 'trouble'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → trouble`, () => expect(hit(vc, p)).toBe(key));
  }
});

describe('JA openers strip & execute', () => {
  const vc = boot();
  const cases = [
    ['あのね閉じて', 'close-tab'], ['ねえ閉じて', 'close-tab'],
    ['あのう閉じて', 'close-tab'], ['えっと閉じて', 'close-tab'],
    ['そういえば閉じて', 'close-tab'], ['なんか閉じて', 'close-tab'],
    ['いいから閉じて', 'close-tab'], ['いい加減閉じて', 'close-tab'],
    ['とりあえず閉じて', 'close-tab'], ['とりま閉じて', 'close-tab'],
    ['マジで閉じて', 'close-tab'], ['ガチで閉じて', 'close-tab'],
    ['今すぐ閉じて', 'close-tab'], ['すぐに閉じて', 'close-tab'],
    ['すぐ閉じて', 'close-tab'], ['今閉じて', 'close-tab'],
    ['この場で閉じて', 'close-tab'],
    ['明日閉じて', 'defer'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hit(vc, p)).toBe(key));
  }
});

describe('JA emphasis & quotative tails', () => {
  const vc = boot();
  const cases = [
    ['閉じてよお', 'close-tab'], ['閉じてよね', 'close-tab'],
    ['閉じなよね', 'close-tab'], ['閉じろよお', 'close-tab'],
    ['閉じろってばよ', 'close-tab'], ['閉じてくれよお', 'close-tab'],
    ['閉じてほしいんだけどさ', 'close-tab'], ['閉じてほしいんだが', 'close-tab'],
    ['閉じてほしいんよ', 'close-tab'], ['閉じてほしいんやけど', 'close-tab'],
    ['閉じてほしいわー', 'close-tab'],
    ['閉じてって言ってる', 'close-tab'], ['閉じてって言ってんのに', 'close-tab'],
    ['閉じてって言ったじゃん', 'close-tab'], ['閉じてと言った', 'close-tab'],
    ['閉じよと言った', 'close-tab'], ['閉じろと言ったでしょ', 'close-tab'],
    ['閉じろと言いました', 'close-tab'], ['閉じてだって', 'close-tab'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → close-tab`, () => expect(hit(vc, p)).toBe(key));
  }
});

describe('JA negative rhetorical (urge → execute)', () => {
  const vc = boot();
  const cases = [
    ['閉じないでどうする', 'close-tab'], ['閉じずにどうする', 'close-tab'],
    ['閉じなくてどうする', 'close-tab'], ['読まずにどうする', 'read-aloud'],
    ['読まないでどうする', 'read-aloud'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hit(vc, p)).toBe(key));
  }
});

describe('EN permission questions → help (non-execute)', () => {
  const vc = boot();
  const cases = [
    'would it be ok to close it', 'would it be alright to close it',
    'is it fine to close it', 'is it okay if i close it',
    'is it alright if i close it', 'do you mind if i close it',
  ];
  for (const p of cases) {
    test(`"${p}" → help`, () => expect(hit(vc, p)).toBe('help'));
  }
});

describe('EN intent declarations & emphasis → execute', () => {
  const vc = boot();
  const cases = [
    'let me close it', 'lemme close it', 'allow me to close it',
    'i want to close it', 'i wanna close it', 'i need to close it',
    'i have to close it', 'i gotta close it', 'i must close it',
    'i should close it', 'i ought to close it', 'id like to close it',
    'i would like to close it', 'im going to close it', 'im gonna close it',
    'ill close it', 'i will close it', 'may i please close it',
    'might i close it',
    'i told you to close it', 'i said close it', 'i asked you to close it',
    'for the last time close it', 'one more time close it', 'again close it',
    'close it already', 'close it asap', 'close it immediately',
    'close it right away', 'close it this instant', 'close it at once',
    'close it now please', 'close it if you would', 'close it if you please',
    'close it would you', 'close it will you', 'close it wont you',
    'close it can you', 'close it could you', 'close it might you',
    'close it shall we', 'just close it', 'just close it already',
    'just shut it', 'kindly close it', 'do close it', 'please do close it',
    'come on close it', 'cmon close it', 'ffs close it',
    'for goodness sake close it', 'for heavens sake close it',
    'god just close it', 'jesus close it',
    'uh close it', 'um close it', 'like close it', 'you know close it',
    'i mean close it', 'sort of close it', 'basically close it',
    'actually close it', 'literally close it', 'seriously close it',
    'honestly close it', 'really close it', 'definitely close it',
    'totally close it', 'be so kind as to close it',
    'be a doll and close it', 'do us all a favor and close it',
  ];
  for (const p of cases) {
    test(`"${p}" → close-tab`, () => expect(hit(vc, p)).toBe('close-tab'));
  }
});

describe('EN status questions (no side effects)', () => {
  const vc = boot();
  const cases = [
    ['is it still muted', 'mute-status'],
    ['did it reload', 'working-status'], ['did it refresh', 'working-status'],
    ['did it finish', 'working-status'], ['is it finished', 'working-status'],
    ['is it done', 'working-status'], ['is it still going', 'working-status'],
    ['is it still running', 'working-status'], ['is it still playing', 'working-status'],
    ['has it finished', 'working-status'], ['has it saved', 'working-status'],
    ['has it stopped', 'working-status'], ['did it pause', 'working-status'],
    ['did it resume', 'working-status'], ['did it restart', 'working-status'],
    ['did it launch', 'working-status'], ['is it still open', 'describe-tab'],
    ['halfway there', 'reader-progress'], ['nearly finished', 'reader-progress'],
    ['almost finished', 'reader-progress'], ['about halfway', 'reader-progress'],
    ['just about done', 'reader-progress'], ['getting there', 'reader-progress'],
    ['leave fullscreen', 'vr-exit'], ['leave full screen', 'vr-exit'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hit(vc, p)).toBe(key));
  }
});

describe('EN honest atoms & fills', () => {
  const vc = boot();
  const cases = [
    ['open finder', 'device-apps'], ['open explorer', 'device-apps'],
    ['open file manager', 'device-apps'], ['open task manager', 'device-apps'],
    ['open the trash', 'device-apps'], ['empty trash', 'device-apps'],
    ['open spotlight', 'device-apps'], ['open the dock', 'device-apps'],
    ['open launchpad', 'device-apps'], ['go live', 'screen-record'],
    ['record my screen', 'screen-record'], ['screen record', 'screen-record'],
    ['start recording', 'screen-record'], ['stop recording', 'screen-record'],
    ['record this', 'screen-record'], ['share my screen', 'screen-record'],
    ['screen share', 'screen-record'], ['livestream this', 'screen-record'],
    ['clear my clipboard', 'privacy-clean'], ['clear clipboard', 'privacy-clean'],
    ['half screen', 'window-state'], ['quarter screen', 'window-state'],
    ['tile the windows', 'window-state'], ['cascade windows', 'window-state'],
    ['arrange windows', 'window-state'],
    ['capture the screen', 'screenshot'],
    ['read the text', 'read-aloud'], ['read the content', 'read-aloud'],
    ['read the main text', 'read-aloud'], ['read the body', 'read-aloud'],
    ['read the words', 'read-aloud'],
    ['ffs', 'trouble'],
    ['thank you kindly', 'ack'], ['many thanks', 'ack'],
    ['thanks so much', 'ack'], ['big thanks', 'ack'], ['huge thanks', 'ack'],
    ['really appreciate it', 'ack'], ['cant thank you enough', 'ack'],
    ['youre a lifesaver', 'ack'], ['you saved me', 'ack'], ['life saver', 'ack'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hit(vc, p)).toBe(key));
  }
});

describe('JA honest atoms & fills', () => {
  const vc = boot();
  const cases = [
    ['タスクマネージャー', 'device-apps'], ['ファイラーを開いて', 'device-apps'],
    ['エクスプローラー', 'device-apps'], ['デスクトップを表示', 'device-apps'],
    ['ゴミ箱を空にして', 'device-apps'], ['スタートメニュー', 'device-apps'],
    ['タスクバー', 'device-apps'],
    ['録画して', 'screen-record'], ['画面録画', 'screen-record'],
    ['画面収録', 'screen-record'], ['配信して', 'screen-record'],
    ['画面共有して', 'screen-record'], ['キャプチャして', 'screenshot'],
    ['スクショ取って', 'screenshot'],
    ['クリップボードを消して', 'privacy-clean'],
    ['メモ書きして', 'device-apps'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hit(vc, p)).toBe(key));
  }
});

describe('coexistence (established routes preserved)', () => {
  const vc = boot();
  const cases = [
    ['閉じて', 'close-tab'], ['閉じてください', 'close-tab'],
    ['閉じても構いません', 'close-tab'], ['may i close it', 'close-tab'],
    ['can i close it now', 'help'], ['mind if i close it', 'help'],
    ['close the tab', 'close-tab'], ['戻って', 'back'], ['読んで', 'read-aloud'],
    ['mute it', 'mute-toggle'], ['is it muted', 'mute-status'],
    ['exit fullscreen', 'vr-exit'], ['fullscreen', 'vr-enter'],
    ['go home', 'home'], ['open youtube', 'go-to'],
    ['is it still loading', 'loading-status'], ['whats playing', 'video-status'],
    ['excuse me', 'say-again'], ['shut up', 'mute-toggle'],
    ['あとちょっと', 'remaining-time'], ['reading progress', 'reader-progress'],
    ['download', 'download'], ['view source', 'devtools'],
    ['share this page', 'share-page'], ['stop recording the meeting', 'screen-record'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hit(vc, p)).toBe(key));
  }
});

const VCB = require('../src/vr/input/VoiceCommands').VoiceCommands;

function bootB() {
  const vc = new VCB({ enabled: true });
  const tm = {
    tabs: [{ title: 'A' }, { title: 'B' }],
    activeIndex: 0,
    getActiveTab() { return this.tabs[this.activeIndex]; },
    closeTab() {}, setActive(i) { this.activeIndex = i; },
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  return vc;
}

function hitB(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase);
  return vc.lastCommand && vc.lastCommand.key;
}

describe('JA permission/honorific tails II (execute)', () => {
  const vc = bootB();
  const cases = [
    ['閉じてもよろしいでしょうか', 'close-tab'],
    ['閉じてもいいんですか', 'close-tab'],
    ['閉じても大丈夫ですか', 'close-tab'],
    ['閉じてもらえませんか', 'close-tab'],
    ['閉じてもらえますでしょうか', 'close-tab'],
    ['閉じていただけますか', 'close-tab'],
    ['閉じていただきたいです', 'close-tab'],
    ['閉じていただきたいのですが', 'close-tab'],
    ['閉じていただけますでしょうか', 'close-tab'],
    ['閉じていただけないでしょうか', 'close-tab'],
    ['閉じていただくことはできますか', 'close-tab'],
    ['閉じていただけますと幸いです', 'close-tab'],
    ['閉じていただけるとありがたい', 'close-tab'],
    ['閉じていただけると助かります', 'close-tab'],
    ['閉じてくださると助かります', 'close-tab'],
    ['閉じてくれると助かる', 'close-tab'],
    ['閉じてくれたら助かる', 'close-tab'],
    ['閉じてくれればいい', 'close-tab'],
    ['閉じてくれさえすれば', 'close-tab'],
    ['閉じてさえくれれば', 'close-tab'],
    ['閉じさえしてくれれば', 'close-tab'],
    ['閉じさえすれば', 'close-tab'],
    ['閉じすればいい', 'close-tab'],
    ['閉じすらして', 'close-tab'],
    ['閉じたらどうです', 'close-tab'],
    ['閉じたらいかがですか', 'close-tab'],
    ['閉じたほうがいいんじゃない', 'close-tab'],
    ['閉じたほうがいいと思う', 'close-tab'],
    ['読んでもよろしいですか', 'read-aloud'],
    ['戻ってもいいんですか', 'back'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hitB(vc, p)).toBe(key));
  }
});

describe('JA obligation tails II (execute)', () => {
  const vc = bootB();
  const cases = [
    ['閉じないとまずい', 'close-tab'], ['閉じないと困る', 'close-tab'],
    ['閉じないとだめだ', 'close-tab'], ['閉じないとやばい', 'close-tab'],
    ['閉じないといけないんだ', 'close-tab'], ['閉じないといけないんです', 'close-tab'],
    ['閉じなくてはまずい', 'close-tab'],
    ['読まないと困る', 'read-aloud'], ['戻らないとまずい', 'back'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hitB(vc, p)).toBe(key));
  }
});

describe('JA status questions & reports', () => {
  const vc = bootB();
  const cases = [
    ['閉じれた', 'describe-tab'], ['閉じれたか', 'describe-tab'],
    ['閉じたか', 'describe-tab'], ['開いたか', 'describe-tab'],
    ['読み終わったか', 'reader-progress'], ['終わったか', 'reader-progress'],
    ['できたか', 'working-status'], ['できた', 'working-status'],
    ['保存できた', 'bookmark-status'], ['保存できたか', 'bookmark-status'],
    ['もういいのか', 'negate'],
    ['まだか', 'working-status'], ['まだですか', 'working-status'],
    ['まだ終わらない', 'working-status'], ['まだ読んでるの', 'reader-progress'],
    ['さっき閉じた', 'describe-tab'], ['もう閉じた', 'describe-tab'],
    ['既に閉じた', 'describe-tab'], ['閉じたって', 'describe-tab'],
    ['閉じたらしい', 'describe-tab'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hitB(vc, p)).toBe(key));
  }
});

describe('JA fault statements → trouble', () => {
  const vc = bootB();
  const cases = [
    ['閉じないんだが', 'trouble'], ['開かないんですが', 'trouble'],
    ['消えないんだが', 'trouble'], ['止まらないんだが', 'trouble'],
    ['進まないんだが', 'trouble'], ['閉じないから', 'trouble'],
    ['閉じないんだよ', 'trouble'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → trouble`, () => expect(hitB(vc, p)).toBe(key));
  }
});

describe('JA openers strip & execute', () => {
  const vc = bootB();
  const cases = [
    ['あのね閉じて', 'close-tab'], ['ねえ閉じて', 'close-tab'],
    ['あのう閉じて', 'close-tab'], ['えっと閉じて', 'close-tab'],
    ['そういえば閉じて', 'close-tab'], ['なんか閉じて', 'close-tab'],
    ['いいから閉じて', 'close-tab'], ['いい加減閉じて', 'close-tab'],
    ['とりあえず閉じて', 'close-tab'], ['とりま閉じて', 'close-tab'],
    ['マジで閉じて', 'close-tab'], ['ガチで閉じて', 'close-tab'],
    ['今すぐ閉じて', 'close-tab'], ['すぐに閉じて', 'close-tab'],
    ['すぐ閉じて', 'close-tab'], ['今閉じて', 'close-tab'],
    ['この場で閉じて', 'close-tab'],
    ['明日閉じて', 'defer'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hitB(vc, p)).toBe(key));
  }
});

describe('JA emphasis & quotative tails', () => {
  const vc = bootB();
  const cases = [
    ['閉じてよお', 'close-tab'], ['閉じてよね', 'close-tab'],
    ['閉じなよね', 'close-tab'], ['閉じろよお', 'close-tab'],
    ['閉じろってばよ', 'close-tab'], ['閉じてくれよお', 'close-tab'],
    ['閉じてほしいんだけどさ', 'close-tab'], ['閉じてほしいんだが', 'close-tab'],
    ['閉じてほしいんよ', 'close-tab'], ['閉じてほしいんやけど', 'close-tab'],
    ['閉じてほしいわー', 'close-tab'],
    ['閉じてって言ってる', 'close-tab'], ['閉じてって言ってんのに', 'close-tab'],
    ['閉じてって言ったじゃん', 'close-tab'], ['閉じてと言った', 'close-tab'],
    ['閉じよと言った', 'close-tab'], ['閉じろと言ったでしょ', 'close-tab'],
    ['閉じろと言いました', 'close-tab'], ['閉じてだって', 'close-tab'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → close-tab`, () => expect(hitB(vc, p)).toBe(key));
  }
});

describe('JA negative rhetorical (urge → execute)', () => {
  const vc = bootB();
  const cases = [
    ['閉じないでどうする', 'close-tab'], ['閉じずにどうする', 'close-tab'],
    ['閉じなくてどうする', 'close-tab'], ['読まずにどうする', 'read-aloud'],
    ['読まないでどうする', 'read-aloud'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hitB(vc, p)).toBe(key));
  }
});

describe('EN permission questions → help (non-execute)', () => {
  const vc = bootB();
  const cases = [
    'would it be ok to close it', 'would it be alright to close it',
    'is it fine to close it', 'is it okay if i close it',
    'is it alright if i close it', 'do you mind if i close it',
  ];
  for (const p of cases) {
    test(`"${p}" → help`, () => expect(hitB(vc, p)).toBe('help'));
  }
});

describe('EN intent declarations & emphasis → execute', () => {
  const vc = bootB();
  const cases = [
    'let me close it', 'lemme close it', 'allow me to close it',
    'i want to close it', 'i wanna close it', 'i need to close it',
    'i have to close it', 'i gotta close it', 'i must close it',
    'i should close it', 'i ought to close it', 'id like to close it',
    'i would like to close it', 'im going to close it', 'im gonna close it',
    'ill close it', 'i will close it', 'may i please close it',
    'might i close it',
    'i told you to close it', 'i said close it', 'i asked you to close it',
    'for the last time close it', 'one more time close it', 'again close it',
    'close it already', 'close it asap', 'close it immediately',
    'close it right away', 'close it this instant', 'close it at once',
    'close it now please', 'close it if you would', 'close it if you please',
    'close it would you', 'close it will you', 'close it wont you',
    'close it can you', 'close it could you', 'close it might you',
    'close it shall we', 'just close it', 'just close it already',
    'just shut it', 'kindly close it', 'do close it', 'please do close it',
    'come on close it', 'cmon close it', 'ffs close it',
    'for goodness sake close it', 'for heavens sake close it',
    'god just close it', 'jesus close it',
    'uh close it', 'um close it', 'like close it', 'you know close it',
    'i mean close it', 'sort of close it', 'basically close it',
    'actually close it', 'literally close it', 'seriously close it',
    'honestly close it', 'really close it', 'definitely close it',
    'totally close it', 'be so kind as to close it',
    'be a doll and close it', 'do us all a favor and close it',
  ];
  for (const p of cases) {
    test(`"${p}" → close-tab`, () => expect(hitB(vc, p)).toBe('close-tab'));
  }
});

describe('EN status questions (no side effects)', () => {
  const vc = bootB();
  const cases = [
    ['is it still muted', 'mute-status'],
    ['did it reload', 'working-status'], ['did it refresh', 'working-status'],
    ['did it finish', 'working-status'], ['is it finished', 'working-status'],
    ['is it done', 'working-status'], ['is it still going', 'working-status'],
    ['is it still running', 'working-status'], ['is it still playing', 'working-status'],
    ['has it finished', 'working-status'], ['has it saved', 'working-status'],
    ['has it stopped', 'working-status'], ['did it pause', 'working-status'],
    ['did it resume', 'working-status'], ['did it restart', 'working-status'],
    ['did it launch', 'working-status'], ['is it still open', 'describe-tab'],
    ['halfway there', 'reader-progress'], ['nearly finished', 'reader-progress'],
    ['almost finished', 'reader-progress'], ['about halfway', 'reader-progress'],
    ['just about done', 'reader-progress'], ['getting there', 'reader-progress'],
    ['leave fullscreen', 'vr-exit'], ['leave full screen', 'vr-exit'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hitB(vc, p)).toBe(key));
  }
});

describe('EN honest atoms & fills', () => {
  const vc = bootB();
  const cases = [
    ['open finder', 'device-apps'], ['open explorer', 'device-apps'],
    ['open file manager', 'device-apps'], ['open task manager', 'device-apps'],
    ['open the trash', 'device-apps'], ['empty trash', 'device-apps'],
    ['open spotlight', 'device-apps'], ['open the dock', 'device-apps'],
    ['open launchpad', 'device-apps'], ['go live', 'screen-record'],
    ['record my screen', 'screen-record'], ['screen record', 'screen-record'],
    ['start recording', 'screen-record'], ['stop recording', 'screen-record'],
    ['record this', 'screen-record'], ['share my screen', 'screen-record'],
    ['screen share', 'screen-record'], ['livestream this', 'screen-record'],
    ['clear my clipboard', 'privacy-clean'], ['clear clipboard', 'privacy-clean'],
    ['half screen', 'window-state'], ['quarter screen', 'window-state'],
    ['tile the windows', 'window-state'], ['cascade windows', 'window-state'],
    ['arrange windows', 'window-state'],
    ['capture the screen', 'screenshot'],
    ['read the text', 'read-aloud'], ['read the content', 'read-aloud'],
    ['read the main text', 'read-aloud'], ['read the body', 'read-aloud'],
    ['read the words', 'read-aloud'],
    ['ffs', 'trouble'],
    ['thank you kindly', 'ack'], ['many thanks', 'ack'],
    ['thanks so much', 'ack'], ['big thanks', 'ack'], ['huge thanks', 'ack'],
    ['really appreciate it', 'ack'], ['cant thank you enough', 'ack'],
    ['youre a lifesaver', 'ack'], ['you saved me', 'ack'], ['life saver', 'ack'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hitB(vc, p)).toBe(key));
  }
});

describe('JA honest atoms & fills', () => {
  const vc = bootB();
  const cases = [
    ['タスクマネージャー', 'device-apps'], ['ファイラーを開いて', 'device-apps'],
    ['エクスプローラー', 'device-apps'], ['デスクトップを表示', 'device-apps'],
    ['ゴミ箱を空にして', 'device-apps'], ['スタートメニュー', 'device-apps'],
    ['タスクバー', 'device-apps'],
    ['録画して', 'screen-record'], ['画面録画', 'screen-record'],
    ['画面収録', 'screen-record'], ['配信して', 'screen-record'],
    ['画面共有して', 'screen-record'], ['キャプチャして', 'screenshot'],
    ['スクショ取って', 'screenshot'],
    ['クリップボードを消して', 'privacy-clean'],
    ['メモ書きして', 'device-apps'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hitB(vc, p)).toBe(key));
  }
});

describe('coexistence (established routes preserved)', () => {
  const vc = bootB();
  const cases = [
    ['閉じて', 'close-tab'], ['閉じてください', 'close-tab'],
    ['閉じても構いません', 'close-tab'], ['may i close it', 'close-tab'],
    ['can i close it now', 'help'], ['mind if i close it', 'help'],
    ['close the tab', 'close-tab'], ['戻って', 'back'], ['読んで', 'read-aloud'],
    ['mute it', 'mute-toggle'], ['is it muted', 'mute-status'],
    ['exit fullscreen', 'vr-exit'], ['fullscreen', 'vr-enter'],
    ['go home', 'home'], ['open youtube', 'go-to'],
    ['is it still loading', 'loading-status'], ['whats playing', 'video-status'],
    ['excuse me', 'say-again'], ['shut up', 'mute-toggle'],
    ['あとちょっと', 'remaining-time'], ['reading progress', 'reader-progress'],
    ['download', 'download'], ['view source', 'devtools'],
    ['share this page', 'share-page'], ['stop recording the meeting', 'screen-record'],
  ];
  for (const [p, key] of cases) {
    test(`"${p}" → ${key}`, () => expect(hitB(vc, p)).toBe(key));
  }
});
