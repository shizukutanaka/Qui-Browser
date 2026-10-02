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
  // dental appointment & checkup done (定期検検診・歯科呼ばれの終了側)
  'dentist visit', 'appointment booked',
  'follow up done', 'teeth checked',
  'prescription picked',
];
const closeTabJa = [
  '定期検診', '予約して',
  '呼ばれて', 'フッ素を塗って',
  'クリーニング', '虫歯を治して',
];
const negate = [
  'still at the dentist',
  'これから歯医者',
];
const nullPins = [
  'about to go', 'mid cleaning', 'dentist appointment',
  '歯科', '歯医者',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['checkup done', 'close-tab'],
  ['cleaning done', 'close-tab'],
  ['cavity filled', 'close-tab'],
  ['治療が終わって', 'close-tab'],
  ['歯医者終了', 'close-tab'],
  ['まだ治療中', 'negate'],
  ['歯医者に行って', 'go-to'],
];

describe('pass CDLXV: dental-checkup idioms (banjo)', () => {
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
