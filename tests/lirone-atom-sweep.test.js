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
  // national park designated & alien species regulated
  'national park designated', 'alien species regulated',
];
const closeTabJa = [
  '環境省', '自然公園法',
  '国立公園', '国定公園',
  '自然保護区', '特別鳥獣保護区',
  '特別保護地区', '絶滅危惧種',
  '外来生物法', '特定外来生物',
  '野生生物保護', '生物多様性基本法',
  '生物多様性戦略', '里地里山',
  '天然記念物', '保護林',
  '原生林', '希少野生動植物種',
  'ラムサール条約', '世界自然遺産',
  'エコツーリズム', 'ネイチャーガイド',
  '公園管理', 'ビジターセンター',
  '利用調整地区', '国立環境研究所',
  '環境再生', '環境保全団体',
];
const negate = [
  'still awaiting the park designation',
  'まだ公園指定前', 'これから区域指定',
];
const nullPins = [
  'about to file the nature survey',
  'about to join the ranger program',
];
const establishedPins = [
  // already pinned close-tab — registered 特別鳥獣保護区 instead
  ['鳥獣保護区', 'close-tab'],
  // already pinned negate — registered まだ公園指定前/これから区域指定 instead
  ['これから指定申請', 'negate'],
];

describe('pass DCXLII: nature conservation & national park administration idioms (lirone)', () => {
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
