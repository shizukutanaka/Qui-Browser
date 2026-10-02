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
  // senior-driver course & license procedures done
  'senior driving course done',
];
const closeTabJa = [
  '免許返納', '運転免許返納',
  '運転経歴証明書', '高齢運転者講習',
  '認知機能検査', '運転免許センター',
  '更新講習', '免許更新',
  '運転免許証', 'ゴールド免許',
  '優良運転者', '違反者講習',
  '初心運転者', '指定自動車教習所',
  '運転免許試験場', '運転技能検査',
  '自転車講習', '安全運転管理者',
  '運転記録証明書', '運転免許停止',
];
const negate = [
  'still licensed',
  'これから返納',
];
const nullPins = [
  'about to surrender',
];
const establishedPins = [
  ['license surrendered', 'close-tab'],
  ['まだ運転中', 'negate'],
];

describe('pass DXLIX: senior-driver license idioms (rebec)', () => {
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
