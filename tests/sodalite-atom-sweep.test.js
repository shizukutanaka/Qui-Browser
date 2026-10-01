// pass CCXCIV sweep: EN referee/ejection + library/archive disposal idioms;
// JA 退場/失格/戦力外 + 図書/蔵書 chains, plus coexistence pins.
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

const tm = {
  getActiveTab: () => ({ title: 't', url: 'u' }),
  closeTab: () => {},
  tabs: [{ title: 't' }]
};

let vc;
beforeEach(() => {
  vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tm);
});

function key(p) {
  vc.lastCommand = null;
  vc.processCommand(p, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

const closeTab = [
  // EN referee / ejection / disqualification
  'yellow card again', 'tossed from the game', 'benched for good',
  'sidelined for good', 'out of bounds', 'foul out', 'fouled out',
  'disqualified', 'dq it', 'hit the showers',
  'ejection seat for it', 'ejector seat', 'match penalty',
  'game misconduct', 'five minute major', 'strike three',
  'three strikes and its out', 'youre out of the game',
  'out of the match', 'match over for it', 'technical foul',
  'flagrant foul', 'personal foul on it', 'illegal play',
  'offside for good', 'penalty box for it', 'in the penalty box',
  'sin bin for it', 'toss it out of play', 'out of the tournament',
  'elimination for it', 'knocked out of the bracket',
  'out of the bracket', 'eliminated for sure',
  // EN library / book / archive
  'end of this book', 'book closed for good',
  'put it back on the shelf', 'back on the shelf', 'reshelve it',
  'library closed', 'library is closing', 'overdue and done',
  'return it to the library', 'return to sender for it',
  'book returned', 'fine for overdue', 'revoke its library card',
  'take it off the shelf', 'archive this tab', 'into the archives',
  'stored away forever', 'postmark it', 'return to sender tab',
  'address unknown', 'dead letter for it', 'dead letter office',
  'index it under closed', 'close the file on it',
  'case file closed', 'file closed permanently',
  'shred the documents', 'burn the records',
  'box it and forget it', 'wrap it and forget it',
  // JA 退場 / 失格 / 反則
  'レッドカード', 'レッドカードを出して', 'イエローカード二枚目',
  '退場宣告', '退場を宣告', '反則負けだ', '反則だ',
  '失格だ', '失格にして', '失格宣告', '出場停止',
  '出禁だ', '出禁にして', 'ベンチ送り', 'ベンチに下げて',
  '控えに下げて', '控えに戻れ', 'ファウルアウト', 'ファウルだ',
  'ペナルティだ', 'ペナルティボックスへ', '場外だ',
  '場外に出して', '場外ファウル', 'オフサイドだ',
  '判定負けだ', 'ジャッジは失格', '審判の判定で終わり',
  'ノーコンテスト', '没収試合だ', '戦線離脱',
  '戦線離脱させて', '脱落だ', '脱落にして', '淘汰されて',
  '敗退だ', '敗退にして', '投げられた', '立ち去れ試合から',
  // JA 図書 / 蔵書 / 返却
  '本を閉じて', '本を閉じた', '閉じた本', '蔵書から外して',
  '蔵書処分', '書庫に戻して', '書庫にしまって', '本棚に戻して',
  '棚に戻して', '返却して', '返却期限切れ', '期限切れの本',
  '延滞だ', '延滞金が発生', '貸出停止', '図書カード没収',
  '借りる資格なし', 'アーカイブに移して', '記録を抹消して',
  '文書をシュレッダー', '書類を燃やして', 'ファイルを閉じて',
  '事件記録を閉じる', '巻物を閉じて', '巻物を畳んで',
  '栞を挟んで閉じて', 'しおり挟んで閉じて', '本に別れを告げて',
  '読み終わりだ', '読了だ', 'もう読まない本', '読み捨てる本',
  'この本は終わり', '物語の終わり', '物語は終わり',
  'あとがきだ', '奥付だ',
  // JA 追放 / 補欠確定 / 戦力外
  '補欠確定', 'レギュラー落ち', 'スタメン落ち', 'メンバー外して',
  'メンバーから外して', 'チームから外れろ', 'チームを追放',
  '追放された選手', '使えない選手', '戦力外通告', '戦力外通達',
  '構想外だ', '構想外にして', '計画から外して', '外れてしまえ',
  'ハズレだ', 'ハズレにして', '番外だ', '番外編にして',
  '格下げだ', '降格にして', '二軍落ち', '二軍に落として',
  '三軍送り', '育成落ち', '支配下外れ', '自由契約だ',
  '契約解除して', '契約切れ', '解雇通告',
];

const pins = [
  ['読了した', 'reader-progress'],          // completion report stays a progress pin
  ['読み切った', 'reader-progress'],        // ditto
  ['bookmark it and forget it', 'bookmark-page'], // explicit bookmark request
  ['ejected from the game', 'close-tab'],   // established literal
  ['close the book on it', 'close-tab'],    // established literal
  ['archive it away', 'close-tab'],         // established literal
  ['戦力外だ', 'close-tab'],                // established literal
  ['降格だ', 'close-tab'],                  // established literal
];

describe('sodalite atom sweep — close-tab literals', () => {
  test.each(closeTab.map(p => [p]))('routes %s to close-tab', (p) => {
    expect(key(p)).toBe('close-tab');
  });
});

describe('sodalite atom sweep — established pins hold', () => {
  test.each(pins)('routes %s to %s', (p, k) => {
    expect(key(p)).toBe(k);
  });
});
