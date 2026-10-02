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
  // letter-writing & reunion-committee done (執筆・連絡係の終了側)
  'letter written', 'invites mailed',
  'address book updated', 'roster done',
  'dues collected', 'reminder sent',
  'rsvp count done', 'venue confirmed',
];
const closeTabJa = [
  '手紙を書いて', 'お礼状を出して',
  '名簿を作って', '会費を集めて',
  '連絡を回して', '出欠を取って',
  '案内状を送って', '宛名書きをして',
];
const negate = [
  'still writing letters', 'about to write',
  'まだ執筆中', 'これから手紙を書く',
];
const nullPins = [
  'mid letters', 'reunion duties', 'mailing list',
  '名簿係中', '同窓会準備', '招待状',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['thank you note sent', 'close-tab'],
  ['招待状を送って', 'close-tab'],
  ['年賀状を書いて', 'close-tab'],
];

describe('pass CDLVI: letter & reunion-committee idioms (gong)', () => {
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
