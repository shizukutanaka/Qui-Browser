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
  // textbook adopted & teacher hiring done
  'textbook adopted', 'teacher hiring done',
];
const closeTabJa = [
  '教科書採択', '教科用図書',
  '検定教科書', '教科書会社',
  '教科書給与', '無償措置',
  '就学奨励費', '新入学用品費',
  '給食費補助', '通学費補助',
  '修学旅行補助', 'pta総会',
  '学校運営協議会', 'コミュニティスクール',
  '学校評価', '教育委員会議',
  '教育長', '校長会',
  '教員採用試験', '教員採用',
  '教員免許', '管理職選考',
  '教員研修', '教育研修センター',
  '教育実習', '学校説明会',
];
const negate = [
  'still awaiting the adoption',
  'まだ採択前', 'まだ審議前',
  'これから採択',
];
const nullPins = [
  'about to adopt the textbook', 'about to run the teacher exam',
];
const establishedPins = [
  ['就学援助', 'close-tab'], ['教育委員会', 'close-tab'],
  ['初任者研修', 'close-tab'],
];

describe('pass DCXIV: textbook-adoption & education-board idioms (sorau)', () => {
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
