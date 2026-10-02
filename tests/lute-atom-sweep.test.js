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
  // regional revitalization corps & local-business support done
  'region support request done',
  'tour of duty finished',
];
const closeTabJa = [
  '地域活性化・企業人', '地域おこし協力隊',
  '協力隊員', '活動終了',
  '起業支援', '定住推進',
  '応援団', 'まちおこし',
  '集落支援', '農商工連携',
  '地域ビジネス', '移住定住',
  '過疎地域', '道の駅',
  '地産地消', '特産品',
  '地域ブランド', 'ふるさと名物',
  '全国地域情報', '地域資源',
  '地域活性化支援',
];
const negate = [
  'まだ任期中', 'これから赴任',
];
const nullPins = [
  'about to relocate',
];
const establishedPins = [
  ['still applying', 'negate'],
  ['任期終了', 'close-tab'],
];

describe('pass DXLVIII: regional revitalization corps idioms (lute)', () => {
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
