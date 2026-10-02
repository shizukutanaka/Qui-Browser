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
  // bike & motorcycle pickup
  'bike picked up', 'motorcycle delivered',
  'got the bike', 'picked up the scooter',
  // registration & setup
  'registration done', 'plates on',
  'insurance set',
  // first rides
  'rode it home', 'first ride done',
  'test ride done',
];
const closeTabJa = [
  '自転車を受け取って', 'バイクが納車されて',
  'バイクを買って', '登録が終わって',
  'ナンバーをつけて', '乗って帰って',
  '初乗りして', '試乗して',
  '原付を受け取って',
];
const negate = [
  'still bike shopping', 'still waiting for the bike',
  'まだバイク探し中', 'まだ納車待ち',
];
const nullPins = [
  'about to buy a bike', 'mid purchase',
  'owners manual', 'registration papers',
  'これから納車', '手続きの途中',
  '取扱説明書', '登録書類',
];
const establishedPins = [
  ['保険に入って', 'close-tab'], // thyme: home insurance wins
];

describe('pass CDXII: bike & motorcycle pickup idioms (xema)', () => {
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
