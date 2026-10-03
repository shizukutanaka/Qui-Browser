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
  // reactor permit granted & smart meter installed
  'reactor permit granted', 'smart meter installed',
];
const closeTabJa = [
  '電気事業法', '一般送配電事業',
  '小売電気事業', '新電力',
  '電力需給', '電力系統',
  '電力取引監視委員会', '託送供給',
  'スマートメーター', '規制料金',
  '自由料金', '再生可能エネルギー',
  '固定価格買取制度', '太陽光発電設備',
  '風力発電認定', '電気主任技術者',
  '電気工事士', '電気工事業',
  '原子力規制委員会', '原子力発電所',
  '核燃料サイクル', '放射性廃棄物',
  '再処理工場', '原子力損害賠償',
  'エネルギー基本計画', 'グリーン電力証書',
  'jepx',
];
const negate = [
  'still awaiting the reactor permit',
  'これから工事届',
];
const nullPins = [
  'about to file the tariff application',
  'about to join the grid operator',
];
const establishedPins = [
  ['まだ許可申請前', 'negate'],
];

describe('pass DCXXVI: electricity & energy administration idioms (ranat)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
