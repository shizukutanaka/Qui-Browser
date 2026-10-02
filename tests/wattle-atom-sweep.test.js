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
  // moving-in greetings
  'meet the neighbors done', 'said hello around',
  'greeted the neighbors', 'brought the gift around',
  'introduced myself', 'moving announcement',
  // community events
  'neighborhood watch done', 'block party done',
  'community clean up done', 'park clean up done',
  'volunteer cleanup done', 'hoa meeting done',
  'neighborhood association done',
  // sharing & errands
  'shared the harvest', 'dropped off the gift',
  'welcome basket delivered', 'came back from the event',
];
const closeTabJa = [
  '挨拶回り終了', '引っ越し挨拶終了',
  '近所に挨拶して', '手土産を配って',
  '自己紹介して',
  '町内清掃終了', 'ボランティア清掃終了',
  '班長を終えて',
  'おすそ分けして', '差し入れを届けて',
  '行事から帰って',
];
const negate = [
  'still at the block party', 'still greeting',
  'まだ挨拶中', 'まだ行事中',
];
const nullPins = [
  'about to greet the neighbors', 'mid block party',
  'welcome basket',
  'これから挨拶', '挨拶の途中',
  '引っ越しの挨拶', '歓迎の品',
];
const establishedPins = [
  ['公園掃除終了', 'close-tab'], ['自治会終了', 'close-tab'],
  ['町内会終了', 'close-tab'],
];

describe('pass CCCLXXXVIII: neighbor-greeting & community end idioms (wattle)', () => {
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
