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
  // union grievance filed & strike vote passed
  'union grievance filed', 'strike vote passed',
];
const closeTabJa = [
  '労働協約', 'ストライキ',
  '争議行為', '不当労働行為',
  '労働委員会', '組合費',
  'チェックオフ', '団結権',
  '団体行動権', '服務規程',
  '懲戒処分', '内部通報',
  'パワハラ相談', '過労死ライン',
  '時間外労働', '固定残業',
  '裁量労働', 'フレックスタイム',
  '同一労働同一賃金', '非正規待遇',
  '期間雇用', '雇い止め',
  '整理解雇', '退職勧奨',
  '配転', '出向',
  '就業規則変更',
];
const negate = [
  'still awaiting the grievance',
  'まだ交渉前', 'これから団交',
];
const nullPins = [
  'about to file the grievance', 'about to call the strike vote',
];
const establishedPins = [
  ['労働組合', 'close-tab'], ['団体交渉', 'close-tab'],
  ['就業規則', 'close-tab'], ['36協定', 'close-tab'],
];

describe('pass DCXIII: labor-union & collective-bargaining idioms (kenbau)', () => {
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
  test.each(establishedPins)('pinned "%s" stays "%s"', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
