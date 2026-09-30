// Round 111: deferent-request atoms — JA よう依頼枠・名詞型依頼・て受益残置III +
// EN 深い礼儀ネストII・即時/便宜語尾・可能性枠。
// Failing-first: every expectation below was probed NO-MATCH (or misroute) before impl.
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

describe('deferent-request atoms (round 111)', () => {
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

  // --- JA: dict + よう(に)? + 依頼名詞 frames ---
  test.each([
    ['閉じるようお願いします', 'close-tab'],
    ['閉じるようにお願いします', 'close-tab'],
    ['閉じるようにお願い申し上げます', 'close-tab'],
    ['閉じるよう頼みます', 'close-tab'],
    ['閉じるよう願います', 'close-tab'],
    ['閉じるよう要請します', 'close-tab'],
    ['閉じるよう希望します', 'close-tab'],
    ['閉じるようお願い致します', 'close-tab'],
    ['閉じるようお願いいたします', 'close-tab'],
    ['戻るようお願いします', 'back'],
    ['読むようにお願いします', 'read-aloud'],
    ['進むようお願いします', 'navigate'],
    // dict + bare request nouns
    ['閉じる要請', 'close-tab'],
    ['閉じるお願い', 'close-tab'],
    ['閉じる希望', 'close-tab'],
    ['閉じる依頼', 'close-tab'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- JA: て + benefactive/permission residue III ---
  test.each([
    ['閉じてお願い申し上げます', 'close-tab'],
    ['閉じてお願いいたします', 'close-tab'],
    ['閉じてお願い致します', 'close-tab'],
    ['閉じて頂戴いたします', 'close-tab'],
    ['閉じて頂戴する', 'close-tab'],
    ['閉じてちょうだいする', 'close-tab'],
    ['閉じてくれますかね', 'close-tab'],
    ['閉じてくれりゃ', 'close-tab'],
    ['閉じてくれないかなあ', 'close-tab'],
    ['閉じてくれないですかね', 'close-tab'],
    ['閉じてくださいまし', 'close-tab'],
    ['閉じてくださいますよう', 'close-tab'],
    ['閉じてくださいますようお願いします', 'close-tab'],
    ['閉じてもらうよう', 'close-tab'],
    ['閉じてくださるようお願い申し上げます', 'close-tab'],
    ['閉じてくれるのでしょうか', 'close-tab'],
    ['閉じてくれるんでしょうか', 'close-tab'],
    ['閉じてくれるだろうか', 'close-tab'],
    ['閉じてくれるかどうか', 'close-tab'],
    ['閉じてくださったら', 'close-tab'],
    ['閉じてもらったら', 'close-tab'],
    ['戻ってくれないかなあ', 'back'],
    ['読んでくださいまし', 'read-aloud'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- JA: dict + こと/の/ほう/べき/必要 judgment frames ---
  test.each([
    ['閉じることはできますか', 'close-tab'],
    ['閉じることができますか', 'close-tab'],
    ['閉じることは可能ですか', 'close-tab'],
    ['閉じるべきではある', 'close-tab'],
    ['閉じるべきかと', 'close-tab'],
    ['閉じるべきもの', 'close-tab'],
    ['閉じるべきかもしれない', 'close-tab'],
    ['閉じるのが良い', 'close-tab'],
    ['閉じるのが良いと思う', 'close-tab'],
    ['閉じるのが正しい', 'close-tab'],
    ['閉じるのがいいかも', 'close-tab'],
    ['閉じるのがいいでしょう', 'close-tab'],
    ['閉じることが望ましい', 'close-tab'],
    ['閉じるのが望ましい', 'close-tab'],
    ['閉じるのが好ましい', 'close-tab'],
    ['閉じるほうがいいと思います', 'close-tab'],
    ['閉じるほうがいいです', 'close-tab'],
    ['閉じるほうがいいと考えます', 'close-tab'],
    ['閉じるほうがよろしい', 'close-tab'],
    ['閉じたほうがよろしい', 'close-tab'],
    ['閉じる必要があろう', 'close-tab'],
    ['閉じる必要がありますね', 'close-tab'],
    ['閉じる必要があるのでは', 'close-tab'],
    ['閉じる必要があるようだ', 'close-tab'],
    ['閉じる必要がありそう', 'close-tab'],
    ['閉じる必要ありそう', 'close-tab'],
    ['閉じる必要性がある', 'close-tab'],
    ['閉じる必要があるように思う', 'close-tab'],
    ['戻るのが良い', 'back'],
    ['読むのが望ましい', 'read-aloud'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- EN: deep politeness nests II ---
  test.each([
    ['it would be lovely if you could close it', 'close-tab'],
    ['it would be wonderful if you could close it', 'close-tab'],
    ['it would be fantastic if you could close it', 'close-tab'],
    ['it would help a lot if you could close it', 'close-tab'],
    ['it would mean a lot if you could close it', 'close-tab'],
    ['how would you like to close it', 'close-tab'],
    ['what would you say to closing it', 'close-tab'],
    ['what do you say to closing it', 'close-tab'],
    ['up for closing it', 'close-tab'],
    ['down for closing it', 'close-tab'],
    ['humbly request you close it', 'close-tab'],
    ['i request that you close it', 'close-tab'],
    ['i ask that you close it', 'close-tab'],
    ['i ask you to close it', 'close-tab'],
    ['i beg you to close it', 'close-tab'],
    ['i urge you to close it', 'close-tab'],
    ['i implore you to close it', 'close-tab'],
    ['may i ask you to close it', 'close-tab'],
    ['may i trouble you to close it', 'close-tab'],
    ['think you could close it', 'close-tab'],
    ['reckon you could close it', 'close-tab'],
    ['figure you could close it', 'close-tab'],
    ['guess you could close it', 'close-tab'],
    ['imagine you could close it', 'close-tab'],
    ['believe you could close it', 'close-tab'],
    ['do you think you might close it', 'close-tab'],
    ['do you think you could maybe close it', 'close-tab'],
    ['do you suppose you could close it', 'close-tab'],
    ['do you reckon you could close it', 'close-tab'],
    ['do you figure you could close it', 'close-tab'],
    ['perhaps you could close it', 'close-tab'],
    ['maybe you could close it', 'close-tab'],
    ['possibly you could close it', 'close-tab'],
    ['surely you could close it', 'close-tab'],
    ['certainly you could close it', 'close-tab'],
    ['you could always close it', 'close-tab'],
    ['you could just close it', 'close-tab'],
    ['you can always close it', 'close-tab'],
    ['you can just close it', 'close-tab'],
    ['you might as well close it', 'close-tab'],
    ['you may as well close it', 'close-tab'],
    ['might as well close it', 'close-tab'],
    ['may as well close it', 'close-tab'],
    ['please go back when you can', 'back'],
    ['read it as soon as possible', 'read-aloud'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- EN: immediacy/convenience tails ---
  test.each([
    ['close it if you might', 'close-tab'],
    ['close it when ready', 'close-tab'],
    ['close it when you can', 'close-tab'],
    ['close it when possible', 'close-tab'],
    ['close it at your earliest convenience', 'close-tab'],
    ['close it at your convenience', 'close-tab'],
    ['close it if convenient', 'close-tab'],
    ['close it where possible', 'close-tab'],
    ['close it as soon as possible', 'close-tab'],
    ['close it as quickly as you can', 'close-tab'],
    ['close it as fast as you can', 'close-tab'],
    ['close it as soon as you can', 'close-tab'],
    ['close it at once', 'close-tab'],
    ['close it this instant', 'close-tab'],
    ['close it immediately if possible', 'close-tab'],
    ['close it right away please', 'close-tab'],
    ['close it straightaway', 'close-tab'],
    ['close it forthwith', 'close-tab'],
    ['close it posthaste', 'close-tab'],
    ['close it double quick', 'close-tab'],
    ['close it in a jiffy', 'close-tab'],
    ['close it in a flash', 'close-tab'],
    ['close it in a sec', 'close-tab'],
    ['close it in a moment', 'close-tab'],
    ['close it momentarily', 'close-tab'],
    ['any possibility of closing it', 'close-tab'],
    ['any chance of closing it', 'close-tab'],
    ['is there any chance of closing it', 'close-tab'],
    ['would it be too much to close it', 'close-tab'],
    ['would it be too much trouble to close it', 'close-tab'],
    ['would it be possible to close it', 'close-tab'],
    ['go back at your earliest convenience', 'back'],
    ['go back right away', 'back'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));

  // --- coexistence / regression guards ---
  test.each([
    ['閉じるべきではないか', 'negate'],
    ['close it', 'close-tab'],
    ['戻って', 'back'],
    ['読んで', 'read-aloud'],
    ['is it possible to close it', 'help'],
    ['how do you feel about closing it', 'close-tab'],
    ['閉じてください', 'close-tab'],
    ['閉じるように', 'close-tab'],
    ['first tab', 'first-tab'],
    ['tab 3', 'tab-select'],
  ])('%s → %s', (p, key) => expect(run(p)).toBe(key));
});
