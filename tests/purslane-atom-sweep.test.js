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
  // school-entrance prep done
  'backpack bought', 'randoseru arrived',
  'labels done', 'name tags sewn',
  'lunch set ready', 'gym clothes bought',
  'indoor shoes marked', 'school supplies stocked',
  'uniform fitted', 'class letter read',
];
const closeTabJa = [
  'ランドセルが届いて', '名札をつけて',
  '名前を書いて', 'お弁当セットを買って',
  '体操着を買って', '上履きに名前をつけて',
  '学用品を揃えて', '制服を受け取って',
  '入学準備ができて', '入学通知を読んで',
];
const negate = [
  'still packing the bag', 'still labeling',
];
const nullPins = [
  'about to start school', 'mid preparations',
  'school handbook', 'supply list',
  'もうすぐ入学', '準備の途中',
  '入学案内', '準備リスト',
];
const establishedPins = [
  ['まだ準備中', 'negate'],
];

describe('pass CDXXVI: school-entrance prep idioms (purslane)', () => {
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
