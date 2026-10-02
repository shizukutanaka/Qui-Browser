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
  // victim support granted & counseling session done
  'victim support granted', 'counseling session done',
];
const closeTabJa = [
  '犯罪被害相談', '犯罪被害者支援室',
  '被害者支援', '被害者給付',
  '遺族支援', '犯罪被害年金',
  '犯罪被害給付制度', '医療費支給',
  '慰謝料請求', '被害者手帳',
  '被害者家族会', '支援センター',
  '加害者家族相談', '少年被害相談',
  '被害届不受理',
];
const negate = [
  'still traumatized',
  'まだ支援前', 'これから被害申請',
];
const nullPins = [
  'about to report', 'about to press charges',
];
const establishedPins = [];

describe('pass DLXV: crime-victim support idioms (kalimba)', () => {
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
