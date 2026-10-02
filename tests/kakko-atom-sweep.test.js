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
  // consumer-fraud rescission procedures done
  'contract rescinded', 'refund recovered',
  'fraud reported',
];
const closeTabJa = [
  '契約取消', '悪質商法',
  '訪問販売', '点検商法',
  '消費者センター', '被害回復',
  '内金返還', '解約通知',
  '架空請求', '利殖勧誘',
  'マルチ商法', '特定商取引法',
  '契約書受領',
];
const negate = [
  'still seeking redress',
];
const nullPins = [
  'mid dispute',
];
const establishedPins = [
  ['still negotiating', 'negate'],
  ['about to sign', 'negate'],
  ['settlement reached', 'close-tab'],
  ['クーリングオフ', 'close-tab'],
  ['これから解約', 'negate'],
];

describe('pass DXIV: consumer-fraud rescission idioms (kakko)', () => {
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
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
