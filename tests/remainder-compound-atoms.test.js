// Round 113: remainder-compound atoms — JA ておく/てしまう残置・てから/た後・よう依頼残置・
// べく/べき・ほうが望ましい・お敬語尾拡張・ご覧系 + EN 評価主辞枠/be-a-X 枠/grateful 枠。
// Failing-first: every expectation below was probed NO-MATCH (or misroute) before impl.
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

describe('remainder-compound atoms (round 113)', () => {
  let vc, tm;
  const mkTab = (id, title) => ({ id, title, url: `https://${id}.example.com` });
  beforeEach(() => {
    tm = {
      activeTabId: 't1',
      tabs: [mkTab('t1', 'Example')],
      closeTab() {}, setActive() {}, closeTabs() {}, closeAllTabs() {},
      closeOtherTabs() {}, goBack() {}, goForward() {}, reload() {},
      getActiveTab() { return { title: 'Example', url: 'https://example.com' }; },
    };
    vc = new VoiceCommands({ enabled: true });
    vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  });
  const run = (p) => { vc.lastCommand = null; vc.processCommand(p, 0.9); return vc.lastCommand ? vc.lastCommand.key : 'NONE'; };

  // --- JA: ておく残置 ---
  test.each([
    ['閉じておきますね', 'close-tab'],
    ['閉じておきましょう', 'close-tab'],
    ['閉じておきたい', 'close-tab'],
    ['閉じておくつもり', 'close-tab'],
    ['閉じておく予定', 'close-tab'],
    ['閉じておくことにします', 'close-tab'],
    ['閉じておくことにした', 'close-tab'],
    ['閉じておくね', 'close-tab'],
    ['閉じておいてほしい', 'close-tab'],
    ['閉じておいてくれ', 'close-tab'],
    ['閉じておいてくださいね', 'close-tab'],
    ['閉じておきたいんです', 'close-tab'],
    ['閉じておこうと思います', 'close-tab'],
    ['閉じておこうと思って', 'close-tab'],
    ['戻っておいてほしい', 'back'],
    // とく/とき/とこう contraction mirrors
    ['閉じとこうと思います', 'close-tab'],
    ['閉じとくつもり', 'close-tab'],
    ['閉じとく予定', 'close-tab'],
    ['閉じとくことにする', 'close-tab'],
    ['閉じとくことにした', 'close-tab'],
    ['閉じとくね', 'close-tab'],
    ['閉じといてほしい', 'close-tab'],
    ['閉じといてくれ', 'close-tab'],
    ['閉じといてくださいね', 'close-tab'],
    ['読んどいてほしい', 'read-aloud'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- JA: てしまう残置 ---
  test.each([
    ['閉じてしまってよい', 'close-tab'],
    ['閉じちゃいなさい', 'close-tab'],
    ['閉じちゃってください', 'close-tab'],
    ['閉じちゃってもいい', 'close-tab'],
    ['閉じちゃっていい', 'close-tab'],
    ['閉じじまえ', 'close-tab'],
    ['閉じじゃえ', 'close-tab'],
    ['読んじゃってください', 'read-aloud'],
    ['読んじゃえ', 'read-aloud'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- JA: てから/た後・順序尾 ---
  test.each([
    ['閉じてから次へ', 'close-tab'],
    ['戻ってから閉じて', 'back'],
    ['読んでから続けて', 'read-aloud'],
    ['閉じた後で', 'close-tab'],
    ['閉じた後に', 'close-tab'],
    ['閉じたあとで', 'close-tab'],
    ['閉じたあとに', 'close-tab'],
    ['閉じたら次', 'close-tab'],
    ['閉じれればいい', 'close-tab'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- JA: よう依頼残置・ようにして ---
  test.each([
    ['閉じるようになさい', 'close-tab'],
    ['閉じるようにお願いできますか', 'close-tab'],
    ['閉じるようにしていただけますか', 'close-tab'],
    ['閉じるようにしてもらえますか', 'close-tab'],
    ['閉じるようにしてほしい', 'close-tab'],
    ['閉じるようにしてくれ', 'close-tab'],
    ['閉じるようにして', 'close-tab'],
    ['閉じるよう要求します', 'close-tab'],
    ['閉じるよう依頼します', 'close-tab'],
    ['戻るようになさい', 'back'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- JA: べく/べき/ほうが望ましい ---
  test.each([
    ['閉じるべく', 'close-tab'],
    ['閉じるべくお願いします', 'close-tab'],
    ['閉じるべきと考えます', 'close-tab'],
    ['閉じるべきと存じます', 'close-tab'],
    ['閉じるべきでしょう', 'close-tab'],
    ['閉じるべきものと考えます', 'close-tab'],
    ['閉じることが望ましいと思います', 'close-tab'],
    ['閉じるのが望ましいと思います', 'close-tab'],
    ['閉じたほうが望ましい', 'close-tab'],
    ['閉じるほうが望ましい', 'close-tab'],
    ['閉じるほうがいいと思います', 'close-tab'],
    ['閉じるほうがいいです', 'close-tab'],
    ['閉じるほうがよろしいかと', 'close-tab'],
    ['閉じるほうがよろしいかと思います', 'close-tab'],
    ['閉じたほうがよろしいかと', 'close-tab'],
    ['閉じたほうがよろしいと存じます', 'close-tab'],
    ['閉じたほうがいいと存じます', 'close-tab'],
    ['閉じたほうがいいと考えます', 'close-tab'],
    ['戻るべく', 'back'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- JA: お敬語尾拡張・ご覧系 ---
  test.each([
    ['お閉じくださいますか', 'close-tab'],
    ['お閉じくださいませんか', 'close-tab'],
    ['お閉じくださいませ', 'close-tab'],
    ['お閉じ願えませんか', 'close-tab'],
    ['お閉じいただけませんか', 'close-tab'],
    ['お閉じいただきたい', 'close-tab'],
    ['お閉じ願います', 'close-tab'],
    ['お閉じいたします', 'close-tab'],
    ['お戻りくださいますか', 'back'],
    ['お読みくださいますか', 'read-aloud'],
    ['お進みください', 'navigate'],
    ['ご覧くださいますか', 'describe-tab'],
    ['ご覧いただけますか', 'describe-tab'],
    ['ご閲覧ください', 'describe-tab'],
    ['ご確認ください', 'describe-tab'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- JA: て+ますよう/ましたら/くださいまし・ちょうだい残置 ---
  test.each([
    ['閉じてくれますよう', 'close-tab'],
    ['閉じてくださいますと', 'close-tab'],
    ['閉じてくれますと', 'close-tab'],
    ['閉じてもらえますと', 'close-tab'],
    ['閉じていただけますと', 'close-tab'],
    ['閉じていただけましたら', 'close-tab'],
    ['閉じてくださいましたら', 'close-tab'],
    ['閉じてくれましたら', 'close-tab'],
    ['閉じてもらえましたら', 'close-tab'],
    ['閉じていただいたら', 'close-tab'],
    ['閉じてくださいな', 'close-tab'],
    ['閉じてくださいましね', 'close-tab'],
    ['閉じてちょうだいな', 'close-tab'],
    ['閉じてちょうだいね', 'close-tab'],
    ['戻ってくださいな', 'back'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- EN: evaluative subject frame ---
  test.each([
    ['closing it would be great', 'close-tab'],
    ['closing it would help', 'close-tab'],
    ['closing it would be nice', 'close-tab'],
    ['closing it would be lovely', 'close-tab'],
    ['closing it would be wonderful', 'close-tab'],
    ['closing it would be appreciated', 'close-tab'],
    ['closing it is what i want', 'close-tab'],
    ['closing it is all i ask', 'close-tab'],
    ['closing it is all i need', 'close-tab'],
    ['closing it is the idea', 'close-tab'],
    ['closing it now would be great', 'close-tab'],
    ['to close it is all i ask', 'close-tab'],
    ['to close it now please', 'close-tab'],
    ['kindly close it', 'close-tab'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- EN: be-a-X / courtesy / grateful frames ---
  test.each([
    ['be so good as to close it', 'close-tab'],
    ['be so good and close it', 'close-tab'],
    ['be good enough to close it', 'close-tab'],
    ['be nice enough to close it', 'close-tab'],
    ['be sweet and close it', 'close-tab'],
    ['be a sweetheart and close it', 'close-tab'],
    ['be a darling and close it', 'close-tab'],
    ['be a love and close it', 'close-tab'],
    ['be a saint and close it', 'close-tab'],
    ['be a gem and close it', 'close-tab'],
    ['be a champion and close it', 'close-tab'],
    ['be a hero and close it', 'close-tab'],
    ['be a dearie and close it', 'close-tab'],
    ['be a love and close it please', 'close-tab'],
    ['be lovely and close it', 'close-tab'],
    ['be wonderful and close it', 'close-tab'],
    ['be awesome and close it', 'close-tab'],
    ['be amazing and close it', 'close-tab'],
    ['do me the courtesy of closing it', 'close-tab'],
    ['do me the honor of closing it', 'close-tab'],
    ['do me the pleasure of closing it', 'close-tab'],
    ['do me a solid and close it', 'close-tab'],
    ['do me a kindness and close it', 'close-tab'],
    ['do me a service and close it', 'close-tab'],
    ['do the world a favor and close it', 'close-tab'],
    ['render me a service and close it', 'close-tab'],
    ['extend the courtesy of closing it', 'close-tab'],
    ['afford me the courtesy of closing it', 'close-tab'],
    ['grant me the courtesy of closing it', 'close-tab'],
    ['i would be grateful if you closed it', 'close-tab'],
    ['id be grateful if you closed it', 'close-tab'],
    ['i would appreciate it if you closed it', 'close-tab'],
    ['id appreciate it if you closed it', 'close-tab'],
    ['i would be obliged if you closed it', 'close-tab'],
    ['id be obliged if you closed it', 'close-tab'],
    ['i would be thankful if you closed it', 'close-tab'],
    ['id be thankful if you closed it', 'close-tab'],
    ['i would be most grateful if you closed it', 'close-tab'],
    ['id be most grateful if you closed it', 'close-tab'],
    ['i would be eternally grateful if you closed it', 'close-tab'],
    ['i would be forever grateful if you closed it', 'close-tab'],
    ['it would mean the world if you closed it', 'close-tab'],
    ['it would be splendid if you closed it', 'close-tab'],
    ['it would be delightful if you closed it', 'close-tab'],
    ['it would be much appreciated if you closed it', 'close-tab'],
    ['itd be much appreciated if you closed it', 'close-tab'],
    ['it would be greatly appreciated if you closed it', 'close-tab'],
    ['itd be great if you could close it', 'close-tab'],
    ['itd be nice if you could close it', 'close-tab'],
    ['itd be lovely if you could close it', 'close-tab'],
    ['itd be wonderful if you could close it', 'close-tab'],
    ['itd be awesome if you could close it', 'close-tab'],
    ['itd be appreciated if you could close it', 'close-tab'],
    ['if you could possibly close it', 'close-tab'],
    ['if you could kindly close it', 'close-tab'],
    ['if you could be so kind and close it', 'close-tab'],
    ['if you would be so kind and close it', 'close-tab'],
    ['if you would kindly close it', 'close-tab'],
    ['if you could just possibly close it', 'close-tab'],
    ['if you could just go ahead and close it', 'close-tab'],
    ['if youd just go ahead and close it', 'close-tab'],
    ['if you could please close it for me', 'close-tab'],
    ['if you would please close it for me', 'close-tab'],
    ['if you could please just close it', 'close-tab'],
    ['if you could do me a favor and close it', 'close-tab'],
    ['if you could do me the favor of closing it', 'close-tab'],
    ['if you could possibly be so kind as to close it', 'close-tab'],
    ['suppose you closed it', 'close-tab'],
    ['suppose you could close it', 'close-tab'],
    ['suppose we close it', 'close-tab'],
    ['say you close it', 'close-tab'],
    ['say you could close it', 'close-tab'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- coexistence / regression guards ---
  test.each([
    ['close it', 'close-tab'],
    ['戻って', 'back'],
    ['読んで', 'read-aloud'],
    ['あとで閉じて', 'defer'],
    ['do it later', 'defer'],
    ['閉じるべきではないか', 'negate'],
    ['閉じるべきかと思います', 'help'],
    ['it would help a lot', 'scoped-help'],
    ['first tab', 'first-tab'],
    ['shall i close it', 'help'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));
});
