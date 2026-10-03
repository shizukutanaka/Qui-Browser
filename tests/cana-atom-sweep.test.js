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
  // postage rate revised & delivery route adjusted
  'postage rate revised', 'delivery route adjusted',
];
const closeTabJa = [
  '日本郵政', '中央郵便局',
  '郵便業務', '郵便番号',
  '郵便料金', '郵便貯金',
  '簡易郵便局', '集配局',
  '郵便事業', 'ゆうパック',
  '書留郵便', '特定記録郵便',
  '速達郵便', '航空郵便',
  '船便', '年賀状発売',
  '切手販売', '郵便為替',
  '転居届', '郵便物検査',
  'ユニバーサル郵便', '郵便投票',
  '国際郵便', 'レターパック',
  '定形外郵便', '郵便配達',
];
const negate = [
  'still awaiting the mail service',
  'まだ配達前', 'これから転居届',
];
const nullPins = [
  'about to file the postal complaint',
  'about to open the po box',
  // '郵便局' — drum (CDLV) pins it null; registered '中央郵便局' instead
  '郵便局',
];
const establishedPins = [
  // '配達証明' already pinned close-tab — registered '特定記録郵便' instead
  ['配達証明', 'close-tab'],
];

describe('pass DCXXXIV: postal administration idioms (caña)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
