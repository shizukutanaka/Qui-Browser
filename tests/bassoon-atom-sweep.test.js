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
  // invoice-system & consumption-tax paperwork done
  'invoice number issued', 'tax return amended',
];
const closeTabJa = [
  'インボイス登録', 'インボイス番号',
  '適格請求書', '簡易課税',
  '課税事業者', '免税事業者',
  '消費税申告', '消費税還付',
  '登録通知', '適格請求書発行事業者',
  '登録申請書', '税務署窓口',
  '消費税届出', '課税選択',
  '免税適用',
];
const negate = [
  'still unregistered',
  'まだ届出前', 'これから登録',
];
const nullPins = [
  'about to register', 'about to deregister',
];
const establishedPins = [
  ['税務相談', 'close-tab'],
  ['まだ登録前', 'negate'],
  ['これから申請', 'negate'],
  ['about to file', null],
];

describe('pass DLIX: invoice-system & consumption-tax idioms (bassoon)', () => {
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
