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
  // disaster prep & typhoon aftermath done
  'emergency kit packed', 'gobag ready',
  'water stocked', 'batteries charged',
  'flashlight checked', 'typhoon passed',
  'shutters put away', 'debris cleared',
  'hazard map checked',
];
const closeTabJa = [
  '非常持出を用意して', '備蓄を確認して',
  '水を備蓄して', '乾電池を買って',
  '懐中電灯を確認して', '台風が過ぎて',
  '雨戸を戻して', '停電が復旧して',
  '飛散物を片付けて', 'ハザードマップを確認して',
];
const negate = [
  'still without power', 'still hunkered down',
  'まだ停電中', 'まだ警戒中',
];
const nullPins = [
  'about to stock up', 'mid typhoon',
  'evacuation route', 'supply checklist',
  'これから備蓄', '台風の途中',
  '運転停止', '備蓄リスト',
];
const establishedPins = [
  ['power back on', 'close-tab'],
];

describe('pass CDXXIX: disaster prep & typhoon aftermath idioms (tatsoi)', () => {
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
