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
  // neighborhood association
  'joined the neighborhood association',
  'met the block captain', 'circulated the notice board',
  'passed the kairanban', 'garbage rules learned',
  'duty roster set', 'community dues paid',
  'street cleaning done', 'met the landlord',
  'said hi to the neighbors',
];
const closeTabJa = [
  '町内会に入って', '回覧板を回して',
  '組長に会って', 'ゴミのルールを覚えて',
  '当番を決めて', '町内費を払って',
  '掃除当番を終えて', '大家に挨拶して',
  '自治会に入って', '回覧を渡して',
];
const negate = [
  'still new to the area', 'still learning the rules',
  'まだ回覧板中',
];
const nullPins = [
  'about to join the association', 'mid introduction',
  'notice board', 'garbage schedule',
  'これから町内会', '挨拶の途中',
  '回覧板', 'ゴミ出し表',
];
const establishedPins = [
  ['まだ引っ越したばかり', 'describe-tab'],
];

describe('pass CDXVI: neighborhood & community idioms (dill)', () => {
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
