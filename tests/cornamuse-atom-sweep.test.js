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
  // road use permit granted & detour approved
  'road use permit granted', 'detour approved',
];
const closeTabJa = [
  '道路使用許可', '道路占用',
  '道路工事', '道路上の作業',
  '道路管理者', '国道事務所',
  '道路占用料', '道路法',
  '道路掘削', '電柱占用',
  '地下埋設', '側溝',
  '歩道占用', '車両通行止め',
  '特殊車両通行許可', '制限外積載',
  '道路占用許可', '道路使用届',
];
const negate = [
  'still awaiting the road permit',
  'まだ占用許可前', 'これから使用届',
];
const nullPins = [
  'about to file the road use notice', 'about to occupy the sidewalk',
];

describe('pass DXCVIII: road-use & occupancy-permit idioms (cornamuse)', () => {
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
});
