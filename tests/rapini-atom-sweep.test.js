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
  // festival/live-expedition return done
  'festival done', 'made it back from the show',
  'setlist saved', 'haul shown off',
  'light stick packed', 'photos sorted',
  'cosplay stored', 'off day recovered',
];
const closeTabJa = [
  'フェスから帰って', 'ライブ遠征から帰って',
  'セトリを保存して', '耳鳴りが残って',
  '戦利品を広げて', 'ペンライトをしまって',
  '写真を整理して', 'コスプレをしまって',
  '打ち上げが終わって', 'オフ日に休んで',
];
const negate = [
  'still at the festival', 'still traveling home',
  'まだフェス中', 'まだ帰り道',
];
const nullPins = [
  'about to leave for the show', 'mid festival',
  'festival map', 'setlist',
  'もうすぐライブ', 'フェスの途中',
  '会場マップ', 'セトリ',
];
const establishedPins = [
  ['debrief done', 'close-tab'],
];

describe('pass CDXXVIII: festival & live-expedition return idioms (rapini)', () => {
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
