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
  // beach wrap
  'beach day done', 'beach done', 'left the beach',
  'packed up the cooler', 'umbrella folded',
  'beach umbrella down', 'towels sandy',
  'shook off the sand', 'sand brushed off',
  'sunscreen washed off', 'rinsed off the salt',
  'shower rinsed beach',
  // water end
  'out of the water', 'last swim done',
  'last dip done', 'lifeguard gone',
  'lifeguard off duty', 'tide came in',
  'beach read done', 'shells collected',
  'bonfire out beach', 'fireworks done beach',
  // pool end
  'pool day done', 'out of the pool',
  'last lap swam pool', 'towels dried',
  'locker room done pool', 'swim lesson done kids',
  'floaties deflated', 'pool toys put away',
  'sunburn cooled', 'deck cleared',
  'diving board closed',
];
const closeTabJa = [
  '海水浴終了', '海の家を出て', '海を上がって',
  '砂を落として', 'パラソルを畳んで',
  '浮き輪を畳んで', '日焼け止めを落として',
  '塩を流して', 'シャワーを浴びて海',
  '最後のひと泳ぎ', '潮が満ちて',
  '貝殻を拾い終えて', '花火が終わって海',
  'プールを上がって', 'プールが終わって',
  '最後のレッスン泳ぎ', '水泳が終わって',
  '着替えてプール', 'ロッカーを出てプール',
  '監視員が下がって', 'デッキを畳んで',
  'ビーチを後にして', 'サンダルに履き替えて',
  '濡れた水着をしまって',
];
const negate = [
  'still at the beach', 'まだ海で',
];
const nullPins = [
  'about to swim', 'mid swim', 'beach bag',
  'swim trunks', 'pool pass', 'high tide',
  '海の途中', 'これから海', '水着', 'ビーチバッグ',
];
const establishedPins = [
  ['cooler packed', 'close-tab'],
  ['pool closed', 'close-tab'],
  ['beach tomorrow', 'date'], ['明日海', 'defer'],
];

describe('pass CCCLXIII: beach & pool-day end idioms (chestnut)', () => {
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
