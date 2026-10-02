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
  // blood donation
  'donated blood', 'blood donation done', 'gave blood',
  'donation done', 'needle out', 'bandage on',
  'juice and cookies done', 'rest period done',
  'sat fifteen minutes', 'arm taped up', 'donor card updated',
  'blood drive done', 'blood drive over', 'drive closed',
  'bus donation done', 'mobile unit done',
  'organ donor signed up', 'marrow registry done',
  // volunteering
  'volunteered', 'volunteering done', 'volunteer shift done',
  'shift ended volunteer', 'soup kitchen done', 'served meals',
  'meals served', 'food bank done', 'sorted donations',
  'donations sorted', 'shelter shift done', 'cleanup done',
  'beach cleanup done', 'park cleanup done', 'trash picked up',
  'litter collected', 'bags filled', 'trail cleared',
  'planted trees', 'trees planted', 'community garden done',
  'tutoring done', 'mentored today', 'reading buddies done',
  // fundraiser / charity
  'charity run done', 'walkathon done', 'fundraiser over',
  'fundraiser done', 'fundraising done', 'goal reached',
  'met the goal', 'donations counted', 'tally done',
  'bake sale done', 'raffle drawn', 'tickets drawn',
  'auction raised', 'pledge made', 'pledged', 'donated',
  'gave to charity', 'check written charity', 'gala over',
  'benefit done', 'benefit concert done',
  'signed the clipboard', 'volunteer hours done',
  'thanked by organizer',
];
const closeTabJa = [
  // 献血
  '献血終了', '献血が終わって', '献血してきた',
  '献血を済ませて', '血液を抜いてもらって', '抜血終了',
  '成分献血終了', '全血終了', '献血バス終了',
  '献血ルームを出て', '献血カードをもらって',
  'ジュースをもらって', '休憩を取って献血後', '腕に絆創膏',
  // ボランティア
  'ボランティア終了', 'ボランティアが終わって',
  'ボランティアを終えて', '奉仕活動終了', '炊き出し終了',
  '食事を配って', '配膳終了', 'フードバンク終了',
  '仕分け終了', '寄付品を仕分けて', 'シェルター勤務終了',
  '清掃ボランティア終了', '海岸清掃終了', '公園掃除終了',
  'ゴミ拾い終了', 'ごみ拾い終了', '落ち葉拾い終了',
  '植樹終了', '木を植えて', '植林終了',
  // 募金/チャリティー
  'チャリティー終了', 'チャリティーラン終了', '募金終了',
  '募金活動終了', '募金を集めて', '寄付してきた',
  '寄附してきた', '義援金を送って', 'ふるさと納税して',
  '街頭募金終了', 'バザー終了', 'フリマ終了',
  'くじ引き終了', '目標額に達して', '目標達成して',
  '活動報告を書いて', '活動証明をもらって',
  'ボランティア証明', '時間を記録して',
];
const negate = [
  'still volunteering', 'keep volunteering', 'まだボランティア中',
];
const nullPins = [
  'volunteering now', 'mid shift volunteer', 'donating now',
  'donation appointment', 'sign up to volunteer',
  'more shifts left', '献血中', '募金活動中',
  'ボランティアの途中',
];
const establishedPins = [
  ['hours logged', 'close-tab'], ['採血終了', 'close-tab'],
  ['読み聞かせ終了', 'close-tab'],
  ['certificate earned volunteer', 'security-status'],
  ['blood tomorrow', 'date'],
  ['明日献血', 'defer'], ['明日ボランティア', 'defer'],
  ['ボランティアに行って', 'go-to'], ['献血に行って', 'go-to'],
  ['勉強を教えてきた', 'web-search'],
];

describe('pass CCCXLVIII: donation / volunteering end idioms (lotus)', () => {
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
