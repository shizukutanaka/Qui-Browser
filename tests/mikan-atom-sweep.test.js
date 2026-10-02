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
  // manga-cafe & car-camp checkout done
  'netcafe done', 'slept at the manga cafe',
  'left the booth', 'car slept',
  'roadside station done', 'slept in the car',
  'free drinks had', 'netcafe bill paid',
];
const closeTabJa = [
  'ネカフェを出て', '漫画喫茶を出て',
  'ブースを出て', '車中泊して',
  '道の駅を出て', '車で寝て',
  'フリードリンクを飲んで', 'ネカフェ代を払って',
];
const negate = [
  'still at the netcafe', 'still sleeping in the car',
  'まだネカフェ中', 'まだ車中泊中',
];
const nullPins = [
  'about to check in', 'mid sleep',
  'netcafe booth', 'capsule hotel',
  'これから入る', '仮眠中',
  'ネカフェ席', 'カプセルホテル',
];
const establishedPins = [
  ['シャワーを浴びて', 'close-tab'],
  ['充電して', 'close-tab'],
];

describe('pass CDXXXIII: manga-cafe & car-camp checkout idioms (mikan)', () => {
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
