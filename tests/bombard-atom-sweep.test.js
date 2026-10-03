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
  // waste facility approved & incinerator commissioned
  'waste facility approved', 'incinerator commissioned',
];
const closeTabJa = [
  'ごみ処理場', '焼却場',
  '最終処分場', 'クリーンセンター',
  'リサイクルプラザ', '粗大ごみ処理',
  'ごみ減量', '資源化物回収',
  '容器リサイクル', '小型家電リサイクル',
  '一般廃棄物処理', '産業廃棄物',
  'ごみ持ち込み', '処分場建設',
  'リサイクルセンター', '不燃ごみ',
  '粗大ごみ収集', 'ごみ袋指定',
  'ごみ有料化', '不法投棄取締',
  '廃棄物処理法',
];
const negate = [
  'still awaiting the waste permit',
  'まだ稼働前', 'これから建設申請',
];
const nullPins = [
  'about to site the incinerator', 'about to file the waste plan',
];
const establishedPins = [
  ['まだ許可前', 'negate'],
];

describe('pass DCIII: waste-facility & incinerator-siting idioms (bombard)', () => {
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
  test.each(establishedPins)('pinned "%s" stays "%s"', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
