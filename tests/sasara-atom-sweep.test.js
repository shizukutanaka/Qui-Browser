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
  // subsidy & grant application procedures done
  'grant application filed', 'housing subsidy done',
  'renovation grant claimed', 'documents accepted',
];
const closeTabJa = [
  '補助金申請', '助成金',
  '住宅補助金', 'リフォーム補助金',
  '省エネ補助金', '交付決定',
  '申請済み', '給付手続き',
  '事業復活支援金', '入金確認',
  '補正予算', '学校給食費',
];
const negate = [
  'still applying for the grant', 'about to apply for the subsidy',
  'これから補助',
];
const nullPins = [
  'mid application', 'grant pending',
];
const establishedPins = [
  ['subsidy approved', 'close-tab'],
  ['まだ申請中', 'negate'],
  ['こどもエコすまい', 'negate'],
];

describe('pass DVIII: subsidy & grant application idioms (sasara)', () => {
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
