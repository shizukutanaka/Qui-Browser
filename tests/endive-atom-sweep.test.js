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
  // family milestone ceremonies
  'omiyamairi done', 'baby blessed',
  'shichi go san done', 'photos taken',
  'coming of age done', 'seijin shiki done',
  'half birthday celebrated', 'first birthday done',
];
const closeTabJa = [
  'お宮参りをして', '初参りをして',
  '七五三をして', 'お参り終了',
  '成人式をして', '前撮りをして',
  '食い初めをして', 'お食い初めをして',
];
const negate = [
  'still planning the ceremony', 'still choosing outfits',
  'まだ式の準備中', 'まだ写真選び中',
];
const nullPins = [
  'about to visit the shrine', 'mid photo session',
  'ceremony details', 'photo package',
  'これから神社', '撮影の途中',
  '式次第', '写真データ',
];
const establishedPins = [
  ['shrine visit done', 'close-tab'],
  ['photoshoot done', 'close-tab'],
  ['graduation photos done', 'close-tab'],
  ['写真を撮って', 'screenshot'],
  ['撮影終了', 'close-tab'],
];

describe('pass CDXVII: family milestone ceremony idioms (endive)', () => {
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
