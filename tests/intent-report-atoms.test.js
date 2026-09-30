// -*- coding: utf-8 -*-
// Round 114 (Session 188): intent/report & residual-frame atoms.
// Groups covered:
//  JA ては依頼枠 (はもらえませんか / はいただけませんか / はどうでしょう / はいかが)
//  JA て受益残置VI (やってください / もらっていいですか / もらうわけにはいかないでしょうか)
//  JA 引用・断定残置 (ように言った / なさいってば / なって)
//  JA 意向提案枠 (ようではないか / ようじゃないか / てしまおうではないか / ちゃおうではないか)
//  JA ば+じゃん/のでは (ばいいじゃん / りゃいいじゃん / ちゃえばいいじゃん / ばいいのでは / ばよいのでは)
//  JA 判定枠III (のが筋 / ほうが賢明 / のが妥当・適切 / ことを推奨・おすすめ・望む・期待 / ことにしよう・したい)
//  EN 深礼儀III (be so good as to / be good enough to / do me the kindness of /
//              beseech / entreat / if it please(s) you / pray / prithee)
//  EN 可能性枠II (any way you could / any way for you to / is there any way you could / any chance you might)
//  EN 提案枠 (how about you / what about you / you wanna)
//  EN decency/courtesy (have the decency to / do the decent thing and / have the courtesy to)
//  EN 後置礼儀尾 (X if you would be so kind / X if you would kindly)
//  EN 完了語尾 (and be done with it / and get it over with / once and for all / for good /
//             permanently / for the last time / and lets move on)
//  EN 誤ルート修正: could/can i (get|ask) you to → 実行（help 誤ルート解消）

const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [{ id: 't1', title: 'Example' }],
    closeTab() {}, setActive() {}, closeTabs() {}, closeAllTabs() {},
    closeOtherTabs() {}, goBack() {}, goForward() {}, reload() {},
    getActiveTab() { return { title: 'Example', url: 'https://example.com' }; },
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  return vc;
}

function route(vc, p) {
  vc.lastCommand = null;
  vc.processCommand(p, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : 'NONE';
}

const CASES = [
  // ===== JA ては依頼枠 =====
  ['閉じてはどうでしょう', 'close-tab'],
  ['閉じてはいかがでしょうか', 'close-tab'],
  ['閉じてはいかがですか', 'close-tab'],
  ['閉じてはもらえませんか', 'close-tab'],
  ['閉じてはいただけませんか', 'close-tab'],
  ['戻ってはどうでしょう', 'back'],
  ['戻ってはいかがですか', 'back'],
  ['読んではいかがでしょうか', 'read-aloud'],
  ['読んではもらえませんか', 'read-aloud'],
  ['読んではいただけませんか', 'read-aloud'],
  ['戻ってはいただけませんか', 'back'],

  // ===== JA て受益残置VI =====
  ['閉じてやってください', 'close-tab'],
  ['戻ってやってください', 'back'],
  ['閉じてもらっていいですか', 'close-tab'],
  ['戻ってもらっていいですか', 'back'],
  ['閉じてもらうわけにはいかないでしょうか', 'close-tab'],
  ['戻ってもらうわけにはいかないでしょうか', 'back'],
  ['読んでやってください', 'read-aloud'],

  // ===== JA 引用・断定残置 =====
  ['閉じるように言った', 'close-tab'],
  ['戻るように言った', 'back'],
  ['読むように言った', 'read-aloud'],
  ['閉じなさいってば', 'close-tab'],
  ['戻りなさいってば', 'back'],
  ['閉じなって', 'close-tab'],
  ['戻りなって', 'back'],
  ['読みなって', 'read-aloud'],

  // ===== JA 意向提案枠 =====
  ['閉じようではないか', 'close-tab'],
  ['戻ろうではないか', 'back'],
  ['読もうではないか', 'read-aloud'],
  ['閉じようじゃないか', 'close-tab'],
  ['戻ろうじゃないか', 'back'],
  ['閉じてしまおうではないか', 'close-tab'],
  ['閉じちゃおうではないか', 'close-tab'],
  ['戻ってしまおうではないか', 'back'],

  // ===== JA ば+じゃん/のでは =====
  ['閉じればいいじゃん', 'close-tab'],
  ['閉じりゃいいじゃん', 'close-tab'],
  ['閉じちゃえばいいじゃん', 'close-tab'],
  ['戻ればいいじゃん', 'back'],
  ['戻りゃいいじゃん', 'back'],
  ['読めばいいじゃん', 'read-aloud'],
  ['閉じればいいのでは', 'close-tab'],
  ['閉じればよいのでは', 'close-tab'],
  ['戻ればいいのでは', 'back'],
  ['戻ればよいのでは', 'back'],

  // ===== JA 判定枠III =====
  ['閉じるのが筋', 'close-tab'],
  ['閉じるのが筋では', 'close-tab'],
  ['戻るのが筋', 'back'],
  ['閉じるほうが賢明', 'close-tab'],
  ['戻るほうが賢明', 'back'],
  ['閉じるのが妥当', 'close-tab'],
  ['閉じるのが適切', 'close-tab'],
  ['戻るのが妥当', 'back'],
  ['閉じることを推奨', 'close-tab'],
  ['閉じることをおすすめ', 'close-tab'],
  ['戻ることを推奨', 'back'],
  ['閉じることを望む', 'close-tab'],
  ['閉じることを望みます', 'close-tab'],
  ['戻ることを望みます', 'back'],
  ['閉じることを期待', 'close-tab'],
  ['閉じることにしよう', 'close-tab'],
  ['閉じることにしたい', 'close-tab'],
  ['戻ることにしよう', 'back'],
  ['戻ることにしたい', 'back'],

  // ===== EN 深礼儀III =====
  ['would you be so good as to close it', 'close-tab'],
  ['would you be good enough to close it', 'close-tab'],
  ['would you do me the kindness of closing it', 'close-tab'],
  ['i beseech you to close it', 'close-tab'],
  ['i entreat you to close it', 'close-tab'],
  ['if it please you close it', 'close-tab'],
  ['if it pleases you close it', 'close-tab'],
  ['pray close it', 'close-tab'],
  ['prithee close it', 'close-tab'],
  ['would you be so good as to go back', 'back'],
  ['i beseech you to go back', 'back'],
  ['pray read it', 'read-aloud'],

  // ===== EN 可能性枠II =====
  ['any way you could close it', 'close-tab'],
  ['any way for you to close it', 'close-tab'],
  ['is there any way you could close it', 'close-tab'],
  ['any chance you might close it', 'close-tab'],
  ['any way you could go back', 'back'],
  ['is there any way you could read it', 'read-aloud'],

  // ===== EN 提案枠 =====
  ['how about you close it', 'close-tab'],
  ['what about you close it', 'close-tab'],
  ['you wanna close it', 'close-tab'],
  ['how about you go back', 'back'],
  ['you wanna go back', 'back'],
  ['you wanna read it', 'read-aloud'],

  // ===== EN decency/courtesy =====
  ['have the decency to close it', 'close-tab'],
  ['do the decent thing and close it', 'close-tab'],
  ['have the courtesy to close it', 'close-tab'],
  ['have the decency to go back', 'back'],
  ['have the courtesy to read it', 'read-aloud'],

  // ===== EN 後置礼儀尾 =====
  ['close it if you would be so kind', 'close-tab'],
  ['close it if you would kindly', 'close-tab'],
  ['go back if you would be so kind', 'back'],
  ['read it if you would kindly', 'read-aloud'],

  // ===== EN 完了語尾 =====
  ['close it and be done with it', 'close-tab'],
  ['close it and be done', 'close-tab'],
  ['close it and get it over with', 'close-tab'],
  ['close it and lets move on', 'close-tab'],
  ['close it once and for all', 'close-tab'],
  ['close it for good', 'close-tab'],
  ['close it permanently', 'close-tab'],
  ['close it for the last time', 'close-tab'],
  ['go back and be done with it', 'back'],
  ['read it once and for all', 'read-aloud'],

  // ===== EN 誤ルート修正: request-to-system frames =====
  ['could i get you to close it', 'close-tab'],
  ['can i get you to close it', 'close-tab'],
  ['could i ask you to close it', 'close-tab'],
  ['can i ask you to close it', 'close-tab'],
  ['could i get you to go back', 'back'],
  ['can i ask you to read it', 'read-aloud'],

  // ===== 回帰不変条件 =====
  ['first tab', 'first-tab'],
  ['tab 3', 'tab-select'],
  ['it reopened', 'reopen-tab'],
  ['i want my money back', 'NONE'],
  ['閉じるべきではないか', 'negate'],
  ['閉じるべきかと思います', 'help'],
  ['is it possible to close it', 'help'],
  ['it would help a lot', 'scoped-help'],
  ['あとで閉じて', 'defer'],
  ['元に戻して', 'reopen-tab'],
  ['あとどのくらい', 'remaining-time'],
];

describe('intent/report atoms (round 114)', () => {
  const vc = makeVC();
  test.each(CASES)('%j → %s', (p, expected) => {
    expect(route(vc, p)).toBe(expected);
  });
});
