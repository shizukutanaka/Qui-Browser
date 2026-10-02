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
  // content-certified mail & demand-letter procedures done
  'demand letter sent', 'certified mail delivered',
  'receipt confirmed', 'letter returned',
  'deadline lapsed',
];
const closeTabJa = [
  '内容証明', '催告書',
  '送達確認', '送付済み',
  '受取拒否', '回答期限',
  '民事調停申立', '支払督促',
  '仮執行', '債務承認',
  '和解書',
];
const negate = [
  'still drafting the letter', 'about to send the notice',
  'まだ送付前', 'これから送付',
];
const nullPins = [
  'mid dispute',
];
const establishedPins = [
  ['notice served', 'close-tab'],
  ['配達証明', 'close-tab'],
  ['督促状', 'close-tab'],
];

describe('pass DX: content-certified mail & demand-letter idioms (shoko)', () => {
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
