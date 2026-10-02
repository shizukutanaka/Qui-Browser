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
  // crime-prevention association watch duties done
  'patrol done', 'watch shift ended',
  'crime report filed',
];
const closeTabJa = [
  '防犯パトロール', '防犯協会',
  '青色回転灯', '青パト',
  '街路灯', '防犯カメラ',
  'あんしん安全', 'まちづくり協議会',
  '見守り活動', '登下校見守り',
  'わかもん', 'シルバー防犯',
  '町内パトロール', '防犯灯',
  '交番', '駐在所',
  '防犯連絡所', 'こども110番',
  '空き巣', '防犯訓練',
  '見守り隊', '振り込め詐欺',
  '防犯セミナー', '特殊詐欺',
  '還付金詐欺', 'オレオレ詐欺',
  '防犯マップ',
];
const negate = [
  'still on patrol', 'about to join the watch',
  'これから防犯', 'まだ登録前',
];
const nullPins = [
  'mid signup',
];
const establishedPins = [
  ['まだ巡回中', 'negate'],
];

describe('pass DXXXVII: crime-prevention association idioms (kagurasuzu)', () => {
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
