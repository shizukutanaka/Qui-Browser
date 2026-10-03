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
  // elevator installed & tactile paving laid
  'elevator installed', 'tactile paving laid',
];
const closeTabJa = [
  'バリアフリー法', '交通バリアフリー法',
  '障害者差別解消法', '差別解消',
  '点字ブロック', '音響信号機',
  'エレベーター設置', 'バリアフリー整備',
  '駅舎バリアフリー', '心のバリアフリー',
  '情報バリアフリー', '手話言語',
  '手話通訳', '要約筆記',
  '移動支援', '歩行訓練',
  '点字図書', '音声コード',
  '読書支援', 'バリアフリー情報',
  '観光バリアフリー', 'バリアフリーマップ',
  '障害者雇用促進', '障害者支援法人',
  '障害者芸術', '障害者スポーツ',
  '障害者差別', 'サポートブック',
  'ヘルプマーク', 'バリアフリー認証',
  '駅員研修',
];
const negate = [
  'still awaiting the accessibility audit',
  'まだ整備前', 'これから支援申請',
];
const nullPins = [
  'about to file the discrimination report',
  'about to join the sign-language circle',
];
const establishedPins = [
  ['同行援護', 'close-tab'],
  ['自立訓練', 'close-tab'],
  ['まだ認定前', 'negate'],
];

describe('pass DCLXIX: disability non-discrimination & barrier-free administration (seltzer)', () => {
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
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
