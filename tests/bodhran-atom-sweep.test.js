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
  // support-station visited & reintegration plan approved
  'support-station visited', 'reintegration plan approved',
];
const closeTabJa = [
  'ひきこもり相談', '引きこもり支援',
  'ひきこもり地域支援センター', '居場所づくり',
  'ひきこもり家族会', '社会復帰訓練',
  '不登校特例校', '通信制高校',
  'フリースクール', 'ユースセンター',
  '若者サポートステーション', 'ジョブカフェ',
  '若者自立相談', 'サポステ',
  '若者自立塾',
];
const negate = [
  'still socially withdrawn',
  'まだ閉じこもり中', 'これから相談予約',
];
const nullPins = [
  'about to enroll in a free school', 'about to reach out',
];
const establishedPins = [
  ['まだ登録前', 'negate'],
];

describe('pass DLXIX: hikikomori-support & youth-independence idioms (bodhran)', () => {
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
  test.each(establishedPins)('"%s" keeps pin %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
