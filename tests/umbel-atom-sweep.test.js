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
  // job-hunt event end
  'info session done', 'internship over',
  'career fair done', 'networking event done',
  'informational interview done', 'job fair done',
  'exchanged business cards', 'submitted my resume',
  'applied to the internship', 'mentor meeting done',
  'career center visit done', 'networking done',
];
const closeTabJa = [
  '会社説明会終了', 'インターン終了',
  '就活イベント終了', 'キャリアフォーラム終了',
  '企業訪問終了', '履歴書を出して',
  'エントリーシートを出して', 'メンター面談終了',
  'インターンシップ終了', '名刺を渡して',
];
const negate = [
  'still at the career fair', 'still at the info session',
  'まだ説明会中', 'まだインターン中',
];
const nullPins = [
  'about to leave the event', 'mid networking',
  'event badge', 'name card',
  'これから退場', '説明会の途中',
  '名札',
];
const establishedPins = [
  ['company visit done', 'close-tab'],
  ['名刺交換して', 'close-tab'],
  ['説明会に行ってきて', 'go-to'],
  ['キャリアセンターに行って', 'go-to'],
];

describe('pass CCCXCVIII: job-hunt event & internship end idioms (umbel)', () => {
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
