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
  // bike registration done & impounded bike reclaimed
  'bike registration done', 'impounded bike reclaimed',
];
const closeTabJa = [
  '防犯登録', '自転車駐車',
  '放置自転車', '撤去警告',
  '保管引取', '防犯登録番号',
  '自転車保険加入', '安全利用促進',
  '駐輪料金', '定期駐輪券',
  '乗入禁止', '違法駐輪',
  '電動自転車', '自転車安全基準',
  'ヘルメット努力義務', '自転車保険',
];
const negate = [
  'still unregistered for the bike',
  'まだ防犯登録前', 'まだ駐輪前',
];
const nullPins = [
  'about to register the bike', 'about to register the bicycle',
];
const establishedPins = [
  ['still unregistered', 'negate'],
  ['まだ登録前', 'negate'],
];

describe('pass DLXXIX: bicycle-registration & impound idioms (tubular)', () => {
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
