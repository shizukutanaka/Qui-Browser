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
  // typhoon warning issued & quake monitor installed
  'typhoon warning issued', 'quake monitor installed',
];
const closeTabJa = [
  '気象庁', '気象業務法',
  '気象予報士', '気象衛星',
  '観測所', '気象レーダー',
  '震度計', '地震速報',
  '警報発表', '異常気象',
  '火山監視', '気象台',
  '測候所', '気象情報',
  '防災気象', '落雷監視',
  '津波警報', '地震観測',
  '気象観測', '地方気象台',
  '管区気象台', '海洋気象台',
  '航空気象', '気象データ',
  'アメダス',
];
const negate = [
  'still awaiting the weather report',
  'まだ警報前', 'これから観測開始',
];
const nullPins = [
  'about to issue the typhoon warning',
  'about to raise the seismic level',
];

describe('pass DCXXXI: meteorological & seismic administration idioms (daf)', () => {
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
