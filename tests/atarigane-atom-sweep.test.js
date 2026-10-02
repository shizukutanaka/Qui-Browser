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
  // pension early/deferred election procedures done
  'early pension elected', 'deferred pension elected',
  'pension started', 'back payment received',
];
const closeTabJa = [
  '年金繰上げ', '年金繰下げ',
  '繰上げ受給', '繰下げ受給',
  '受給開始', '請求書提出',
  '支給開始', '減額率',
  '増額率', '在職老齢年金',
  '加給年金', '振替加算',
  '厚生年金基金', '共済年金',
];
const negate = [
  'still deciding the start date', 'about to elect deferral',
  'まだ受給時期検討中', 'これから繰下げ申請',
];
const nullPins = [
  'mid pension review', 'pension age reached',
];
const establishedPins = [
  ['受給資格', 'close-tab'],
];

describe('pass DXXI: pension early/deferred election idioms (atarigane)', () => {
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
