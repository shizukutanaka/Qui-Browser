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
  // oshikatsu & fan-activity errands
  'goods bought', 'live merch done',
  'fan meet done', 'seichi done',
  'pilgrimage done', 'photo spot done',
  'oshikatsu done', 'support event done',
  'banner made', 'uchiwa made',
];
const closeTabJa = [
  'グッズを買って', '物販を済ませて',
  '聖地巡礼をして', '推し活をして',
  '痛バを作って', 'うちわを作って',
  'グッズ交換をして',
];
const negate = [
  'still saving for merch', 'still queueing for goods',
  'まだグッズ待ち', 'まだ物販並び中',
];
const nullPins = [
  'about to queue', 'mid merch line',
  'goods list', 'venue map',
  'これから物販', '列の途中',
  'グッズリスト', '会場マップ',
];
const establishedPins = [
  ['merch line done', 'close-tab'],
  ['ファンミに行って', 'go-to'],
  ['撮影スポットに行って', 'go-to'],
  ['応援上映に行って', 'go-to'],
];

describe('pass CDXXI: oshikatsu & fan-activity idioms (kale)', () => {
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
