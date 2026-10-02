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
  // will & end-of-life planning done (遺言・終活相談の終了側)
  'will written', 'estate planned',
  'note finished', 'funeral wishes noted',
  'accounts listed', 'advance directive',
];
const closeTabJa = [
  '遺言を書いて',
  '終活して', '相談して',
  '公証して', '葬儀の希望',
  '口座をまとめて', '延命処置',
];
const negate = [
  'still writing',
  'まだ書いて', 'これから書く',
];
const nullPins = [
  'mid planning', 'ending note',
  '終活ノート',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['notarized', 'close-tab'],
  ['papers signed', 'close-tab'],
  ['署名して', 'close-tab'],
  ['about to write', 'negate'],
  // エンディングノート collides with juniper (CCCLXXIV)'s null pin — documented, not added
  ['エンディングノート', null],
];

describe('pass CDLXX: end-of-life planning idioms (bugle)', () => {
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
