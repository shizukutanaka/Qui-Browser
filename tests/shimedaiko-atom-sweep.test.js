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
  // volunteer fire-brigade membership procedures done
  'joined the fire brigade', 'drill completed',
  'brigade resigned',
];
const closeTabJa = [
  '消防団', '消防団入団',
  '入団届', '退団届',
  '消防団員', '分団',
  '部隊編成', '消防訓練',
  '訓練礼式', '操法大会',
  '出初式', '年末警戒',
  '火災警戒', '警防活動',
  '消火栓確認', '水利確認',
  '防火パトロール', '団員手当',
  '報酬支給', '非常招集',
  '緊急出動', 'ポンプ操作',
  'ホース巻き', '消防本部',
];
const negate = [
  'still on standby', 'about to join the brigade',
  'これから入団',
];
const nullPins = [
  'mid training drill',
];
const establishedPins = [
  ['festival duty done', 'close-tab'],
  ['まだ訓練中', 'negate'],
];

describe('pass DXXX: volunteer fire-brigade enrollment idioms (shimedaiko)', () => {
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
