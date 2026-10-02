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
  // freedom-of-information / resident-audit procedures done
  'disclosure request filed', 'documents disclosed',
  'request granted', 'audit petition filed',
];
const closeTabJa = [
  '情報公開請求', '開示請求',
  '公文書開示', '不開示決定',
  '部分開示', '第三者意見',
  '延長決定', '開示決定',
  '開示実施', '請求取下げ',
  '審査会', '情報公開条例',
  '住民監査請求', '監査結果',
  '勧告', '監査委員',
  '住民訴訟', '監査請求書',
  '陳情', '請願',
  '審査会意見',
];
const negate = [
  'still awaiting disclosure', 'about to request records',
  'これから開示請求',
];
const nullPins = [
  'mid appeal process',
];
const establishedPins = [
  ['まだ審査中', 'negate'],
];

describe('pass DXXVIII: FOI & resident-audit request idioms (gyoban)', () => {
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
