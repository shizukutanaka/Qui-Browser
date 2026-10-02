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
  // fishing rights & co-op membership procedures done
  'fishing rights granted', 'coop membership joined',
  'quota set',
];
const closeTabJa = [
  '漁業権', '入会権',
  '漁業権免許', '共同漁業権',
  '定置漁業権', '区画漁業権',
  '漁業協同組合', '漁協',
  '組合員', '出資金',
  '漁業組合', '総代会',
  '漁場', '漁獲高',
  '漁獲量', '漁獲規則',
  '採捕規則', '禁漁期間',
  '解禁日', '遊漁料',
  '遊漁券', '漁船登録',
  '漁船検査', '漁港',
  '漁港整備', '漁師会',
  '漁業従事者', '入会地',
  '漁業調整委員会', '漁業紛争',
];
const negate = [
  'まだ漁期前', 'これから漁期',
  'まだ組合',
];
const nullPins = [
  'mid registration',
];
const establishedPins = [
  ['still fishing', 'negate'],
  ['about to file the claim', 'negate'],
];

describe('pass DXXXIX: fishing rights & co-op idioms (tsugaru)', () => {
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
