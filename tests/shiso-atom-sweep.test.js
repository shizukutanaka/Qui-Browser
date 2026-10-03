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
  // herd certified & quarantine lifted
  'herd certified', 'quarantine lifted',
];
const closeTabJa = [
  // 獣医系
  '獣医師', '獣医師国家試験',
  '獣医師免許', '動物病院開設',
  '獣医療', '獣医大学',
  '獣医学会', '家畜診療',
  '愛玩動物看護師',
  // 防疫・検査
  '家畜伝染病予防法', '家畜防疫官',
  '特定家畜伝染病', '家畜譲渡',
  '屠畜場', 'と畜場',
  'と畜検査', '食肉衛生検査所',
  '食鳥検査', '遺伝子組換え動物',
  '飼料添加物',
  // 繁殖・生産
  '子牛価格', '受精卵移植',
  '胚移植', '家畜登録',
  '血統登録', '種鶏',
  '孵化場', '養鶏場',
  '養豚場', '採卵鶏',
  'ブロイラー', '肉用牛',
  '繁殖雌牛',
  // 動物愛護
  '動物愛護法', '動物愛護行政',
  '動物取扱業者', '第一種動物取扱業',
  '第二種動物取扱業', '地域猫',
  'さくら猫', '殺処分ゼロ',
  'マイクロチップ装着',
];
const negate = [
  'still awaiting the herd inspection',
  'まだ検疫前', 'まだ飼育前',
  'まだ輸入前',
];
const nullPins = [
  'about to file the animal report',
  'about to visit the animal center',
];
const establishedPins = [
  ['outbreak contained', 'close-tab'],
  ['家畜保健衛生所', 'close-tab'],
  ['口蹄疫', 'close-tab'],
  ['鳥インフルエンザ', 'close-tab'],
  ['豚熱', 'close-tab'],
  ['家畜防疫', 'close-tab'],
  ['家畜市場', 'close-tab'],
  ['家畜改良', 'close-tab'],
  ['動物愛護推進員', 'close-tab'],
  ['動物愛護週間', 'close-tab'],
  ['動物愛護センター', 'close-tab'],
  ['譲渡会', 'close-tab'],
  ['これから届出', 'negate'],
];

describe('pass DCLXXIX: veterinary & animal-welfare administration (shiso)', () => {
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
