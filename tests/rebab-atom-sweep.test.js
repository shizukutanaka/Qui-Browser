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
  // hot-spring permit granted & bathhouse licensed
  'hot-spring permit granted', 'bathhouse licensed',
];
const closeTabJa = [
  '温泉法', '採掘許可',
  '温泉事業', '公衆浴場',
  '銭湯', '入浴施設',
  '温泉場', '掘削',
  '温泉利用権', '源泉',
  '入湯税', '温泉旅館',
  '共同浴場', '掘削許可',
  '利用計画', '温泉条例',
  '塩泉', '温泉士',
];
const negate = [
  'still awaiting the onsen permit',
  'まだ掘削前', 'これから掘削',
];
const nullPins = [
  'about to drill the spring', 'about to license the bathhouse',
];

describe('pass DLXXXIX: hot-spring & public-bath idioms (rebab)', () => {
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
});
