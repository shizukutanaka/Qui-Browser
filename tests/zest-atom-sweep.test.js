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
  // library return & copy errand done
  'late fee paid', 'book renewed',
  'hold picked up', 'reservation arrived',
  'library card renewed', 'copy done',
  'scans saved', 'checked out books',
  'returned on time',
];
const closeTabJa = [
  '延滞料を払って', '返却期限を延ばして',
  '予約本を受け取って', '取り寄せが届いて',
  '図書カードを更新して', 'コピーを取って',
  'スキャンを保存して', '本を借りて',
  '期限内に返して',
];
const negate = [
  'still overdue', 'まだ延滞中',
  'まだ借りてる',
];
const nullPins = [
  'about to return them', 'mid checkout',
  'library catalog', 'due date',
  'これから返す', '借りる途中',
  '蔵書検索', '返却期限',
];
const establishedPins = [
  ['本を返して', 'close-tab'],
  ['still reading the borrowed book', 'speaking-status'],
];

describe('pass CDXXXII: library return & copy errand idioms (zest)', () => {
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
