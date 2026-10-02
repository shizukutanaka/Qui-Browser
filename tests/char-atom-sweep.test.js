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
  // grandparent-visit done (祖父母見舞いの終了側)
  'grandkids dropped off', 'care visit done',
  'grandma fed', 'meds sorted',
  'photos shown', 'stories heard',
  'grandchild slept over',
];
const closeTabJa = [
  '孫を預かって', '祖父母に会って',
  '実家の親を見舞って', '薬を仕分けして',
  '昔話を聞いて', 'お泊まりさせて',
  'おじいちゃんに会って', 'おばあちゃんに会って',
];
const negate = [
  'still visiting grandma', 'about to visit',
  'まだ見舞い中',
];
const nullPins = [
  'mid visit', 'grandparents', 'elder care',
  '祖父母', '孫の面倒',
];
const establishedPins = [
  ['visit done', 'close-tab'],
  ['hugged goodbye', 'close-tab'],
  ['ご飯を食べさせて', 'close-tab'],
  ['アルバムを見せて', 'web-search'],
  ['これから会いに行く', 'go-to'],
];

describe('pass CDL: grandparent-visit idioms (char)', () => {
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
