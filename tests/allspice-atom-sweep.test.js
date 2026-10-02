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
  // post-move paperwork
  'change of address done', 'registered at city hall',
  'insurance switched', 'bank notified',
  'voter reg done', 'school transfer done',
  'internet installed', 'landline hooked up',
  'settled the paperwork', 'power switched on',
];
const closeTabJa = [
  '住民票をもらって', '印鑑登録して',
  '免許の住所変更して', '保険を切り替えて',
  '銀行に届けて', '転校手続き終了',
  'ネット開通して', '電気をつけて',
  '手続きを終えて', '役所の手続き終了',
];
const negate = [
  'still doing paperwork',
  'まだ手続きが残って', '手続きを続けて',
];
const nullPins = [
  'about to go to city hall', 'mid paperwork',
  'application form', 'resident card',
  'これから届け出', '手続きの途中',
  '申請書', '転入手続き',
];
const establishedPins = [
  ['paperwork filed', 'close-tab'],
  ['city hall done', 'close-tab'],
  ['license updated', 'close-tab'],
  ['gas turned on', 'close-tab'],
  ['転入届を出して', 'close-tab'],
  ['転出届を出して', 'close-tab'],
  ['wifi set up', 'online-status'],
  ['wifi開通して', 'online-status'],
  ['ガスを開けて', 'go-to'],
  ['水道を開けて', 'go-to'],
  ['still at city hall', 'negate'],
  ['まだ手続き中', 'negate'],
];

describe('pass CDII: post-move paperwork idioms (allspice)', () => {
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
