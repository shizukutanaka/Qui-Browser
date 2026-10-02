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
  // housewarming & neighbor greetings
  'housewarming over', 'met the neighbors',
  'dropped off gifts', 'gift delivered',
  'welcome mat out', 'had people over',
  'toured the new place', 'new home shown',
  'blessed the house', 'house blessed',
];
const closeTabJa = [
  '近所挨拶を終えて', '新居披露終了',
  '新築披露終了', 'ハウスウォーミング終了',
  'お披露目会終了', '人を招いて',
  '家のお披露目', '地鎮祭をして',
];
const negate = [
  'still greeting neighbors', 'still at the housewarming',
  'まだ挨拶回り中', 'まだ披露会中',
];
const nullPins = [
  'about to host', 'mid housewarming',
  'welcome gift', 'housewarming gift',
  'これから挨拶', '披露会の途中',
  '引っ越し挨拶', '新居披露',
];
const establishedPins = [
  ['housewarming done', 'close-tab'],
  ['greeted the neighbors', 'close-tab'],
  ['引っ越し挨拶終了', 'close-tab'],
  ['挨拶回り終了', 'close-tab'],
  ['手土産を配って', 'close-tab'],
  ['open house done', 'go-to'],
];

describe('pass CDV: housewarming & greeting idioms (pepper)', () => {
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
