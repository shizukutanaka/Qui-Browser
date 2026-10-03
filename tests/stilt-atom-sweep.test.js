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
  // startup & incorporation verbs
  'startup grant approved', 'company incorporated',
];
const closeTabJa = [
  // 法制・機関
  '中小企業基本法', '中小企業庁',
  '中小企業', '産業振興センター',
  // 支援・補助
  'ものづくり補助金', '経営革新',
  '事業継続計画', 'bcp',
  // 共済
  '小規模企業共済', '倒産共済',
  '中小企業退職金共済',
  // 創業・開業
  '個人事業主', '開業届',
  '法人設立届', '創業',
  '開業', '創業計画',
  '経営計画', '小規模事業者',
  '個人商店', '事業継承',
  // 会社設立・登記
  '株式会社設立', '合資会社',
  '合同会社', '会社設立',
  '会社登記', '会社',
  // 定款・役員
  '定款', '定款認証',
  '会社法', '資本金',
  '取締役',
  // 営業種目
  '理容所', '美容所',
  'クリーニング店', '自動車整備業',
  '指定整備工場',
];
const negate = [
  'still awaiting the incorporation',
  'まだ設立中', 'まだ創業前',
  'まだ開業中',
];
const nullPins = [
  'about to file the articles of incorporation',
  'about to visit the startup center',
];
const establishedPins = [
  ['創業支援', 'close-tab'],
  ['監査役', 'close-tab'],
  ['商業登記', 'close-tab'],
  ['信用保証協会', 'close-tab'],
  ['保証協会', 'close-tab'],
  ['株主総会', 'close-tab'],
  ['商店会', 'close-tab'],
  ['青色申告', 'close-tab'],
  ['まだ設立前', 'negate'],
  ['これから開業', 'negate'],
  ['まだ登記前', 'negate'],
];

describe('pass DCLXXXV: small-business & company incorporation administration (stilt)', () => {
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
