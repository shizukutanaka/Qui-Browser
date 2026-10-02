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
  // parking contract
  'parking spot rented', 'monthly parking done',
  'garage contract done', 'dedicated spot assigned',
  'parking pass issued',
  // carshare
  'carshare signed up', 'registered for carshare',
  // ev charger
  'charger installed', 'ev charger in',
];
const closeTabJa = [
  '駐車場を契約して', '月極を契約して',
  '車庫を借りて', 'カーシェアに登録して',
  'カーシェアを申し込んで', '充電器を設置して',
  'ev充電を設置して', '充電スポットを作って',
  '専用駐車場を決めて', '駐車許可証をもらって',
];
const negate = [
  'still looking for parking', 'still applying',
  'まだ駐車場探し中', 'まだ申し込み中',
];
const nullPins = [
  'about to sign the parking lease', 'mid application',
  'parking contract', 'charger manual',
  'これから契約', '手続きの途中',
  '駐車契約書', '充電器説明書',
];
const establishedPins = [
  ['charging set up', 'battery-status'], // device charging wins
];

describe('pass CDXV: parking & ev-charger contract idioms (caraway)', () => {
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
