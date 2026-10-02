const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ id: 1 }),
    closeTab: () => {},
    tabs: () => [],
  });
  return vc;
}
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  // date end
  'date over', 'date ended', 'date done', 'first date done',
  'second date done', 'dinner date done', 'coffee date done',
  'lunch date done', 'movie date done',
  // send-off
  'walked her home', 'walked him home', 'walked them home',
  'said goodnight', 'goodnight kiss done', 'kiss goodnight',
  'hugged goodbye', 'dropped her off', 'dropped him off',
  'put her in a cab', 'put him in a cab', 'uber for her',
  'sent her home', 'walked to her door', 'kissed at the door',
  // outcome — good
  'went well', 'went great', 'hit it off', 'sparks flew',
  // outcome — bad / bailed
  'no spark', 'awkward date', 'date went badly',
  'flopped the date', 'ghosted', 'got ghosted', 'stood up',
  'got stood up', 'left early date', 'excused myself',
  'bailed on the date',
  // follow-up / contact
  'texted after', 'texted her after', 'sent the followup',
  'asked for a second date', 'second date planned',
  'next date set', 'exchanged numbers', 'got her number',
  'got his number', 'swapped numbers',
  // money / gestures
  'split the bill', 'picked up the tab', 'paid for dinner',
  'bought her dinner', 'bought him dinner', 'flowers given',
  'gave her flowers', 'complimented her', 'door opened for her',
  'held the door',
  // milestones
  'met the parents', 'met her parents', 'met his parents',
  'family dinner done', 'anniversary dinner done',
  'anniversary done', 'proposal done', 'proposed', 'said yes',
  'she said yes', 'engaged now', 'ring given',
  'popped the question',
  // organized dating
  'blind date done', 'blind date over', 'speed dating done',
  'dating event done', 'mixer done', 'singles night done',
  'matched online', 'first meeting done', 'met in person',
  'coffee meetup done', 'double date done', 'double date over',
  'group date done',
];
const closeTabJa = [
  // デート終了
  'デート終了', 'デートが終わって', 'デートを終えて',
  '初デート終了', '食事デート終了', '映画デート終了',
  'ドライブデート終了',
  // 送り/別れ
  '家まで送って', '送り届けて', 'エスコートして',
  'お見送りして', '別れを告げて', 'じゃあねして',
  '手を振って', 'タクシーに乗せて', 'おやすみのキスをして',
  // 手ごたえ
  '楽しかった', '盛り上がって', 'いい感じで', '脈ありで',
  '脈なしで', '空振りで', 'フラれて', '振られました',
  'ドタキャンされて', 'すっぽかされて', 'フェードアウトして',
  // 連絡先/次回
  '連絡先を交換して', 'lineを交換して', 'ラインを交換して',
  '連絡先を聞いて', '次の約束をして', '次のデートを約束して',
  '二回目の約束', 'お礼のメッセージを送って',
  'フォローアップを送って',
  // 会計/贈り物
  '奢って', 'ごちそうして', '割り勘して', '食事代を払って',
  '花を渡して', 'プレゼントを渡して',
  // 節目
  '両親に会って', '親に紹介して', '家族に会って',
  '記念日を祝って', '記念日デート終了', 'プロポーズして',
  'プロポーズ成功', '指輪を渡して', '婚約しました',
  '婚約した',
  // 婚活/合コン
  'お見合い終了', 'お見合いが終わって', '婚活パーティー終了',
  '婚活終了', '合コンを終えて', '街コン終了',
  'マッチングして', 'マッチした', 'マッチングアプリ終了',
  '初対面終了', '初めて会って', 'ダブルデート終了',
  'グループデート終了',
];
const negate = [
  'still on the date', 'still dating', 'まだデート中',
];
const nullPins = [
  'date going well', 'on a date now', 'mid date',
  'seeing someone', 'デート中', 'デートの途中',
  'デートの約束', 'デートの予定',
];
const establishedPins = [
  ['date tomorrow', 'date'], ['dinner date tomorrow', 'date'],
  ['バイバイして', 'close-tab'], ['早めに切り上げて', 'close-tab'],
  ['お土産を渡して', 'close-tab'],
  ['明日デート', 'defer'], ['明日出会い', 'defer'],
];

describe('pass CCCXLIV: date/omiai end idioms (birch)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa)('"%s" -> close-tab (ja)', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate)('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins)('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
