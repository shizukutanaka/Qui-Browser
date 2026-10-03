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
  // recycling depot opened & compost pickup scheduled
  'recycling depot opened', 'compost pickup scheduled',
];
const closeTabJa = [
  '容器包装リサイクル法', '家電リサイクル法',
  '小型家電回収', '食品リサイクル法',
  '建設廃棄物再資源化', '自動車リサイクル法',
  '資源有効利用促進法', '循環型社会形成推進基本法',
  '再生資源', '新聞紙回収',
  '空き缶回収', 'ペットボトル回収',
  'びん回収', '廃油回収',
  '蛍光灯回収', '乾電池回収',
  'リサイクル拠点', '分別収集',
  '集団回収', '回収協力店',
  'マイバッグ持参', 'レジ袋有料',
  'ごみ減量化', '廃棄物発生抑制',
  'リユース促進', 'エコ活動',
];
const negate = [
  'still awaiting the collection permit',
  'まだ回収前', 'これから分別',
];
const nullPins = [
  'about to file the collection plan',
  'about to join the cleanup crew',
];
const establishedPins = [
  // already pinned close-tab — registered 小型家電回収/建設廃棄物再資源化/新聞紙回収/ごみ減量化 instead
  ['小型家電リサイクル', 'close-tab'],
  ['建設リサイクル法', 'close-tab'],
  ['古紙回収', 'close-tab'],
  ['ごみ減量', 'close-tab'],
];

describe('pass DCXLIII: recycling & waste-reduction administration idioms (flageolet)', () => {
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
