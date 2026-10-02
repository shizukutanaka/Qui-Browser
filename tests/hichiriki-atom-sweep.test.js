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
  // church/temple volunteer service done
  'ushered the service', 'served at mass',
  'altar guild done', 'sacristy tidied',
  'temple grounds cleaned', 'sutra copied',
  'dana box counted', 'usher duty done',
  'collection plate passed',
];
const closeTabJa = [
  '奉仕活動', 'お堂掃除',
  '写経', 'お布施',
  '檀家', '法要手伝い',
  '神社奉納', '宮仕え',
  '寺侍', '境内掃除',
  'お寺の手伝い', '教会奉仕',
  '讃美歌練習',
];
const negate = [
  'about to volunteer',
  'まだ奉仕中', 'これから奉仕',
];
const nullPins = [
  'shift pending', 'mid service',
];
const establishedPins = [
  ['volunteer shift done', 'close-tab'],
  ['still volunteering', 'negate'],
];

describe('pass CDXCIX: temple/church volunteer service idioms (hichiriki)', () => {
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
