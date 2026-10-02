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
  // orthodontics finished
  'braces off', 'braces removed',
  'retainer fitted', 'aligners done',
  'last aligner tray', 'teeth straightened',
  'off the braces',
  // cosmetic & whitening
  'whitening done',
  // treatment completed
  'filling done', 'root canal done',
  'tooth pulled', 'implant done',
  'crown set', 'denture fitted',
  'wisdom teeth out', 'gum graft healed',
  'dental work done', 'mouth healed',
  'six month checkup done',
];
const closeTabJa = [
  '矯正が外れて', '矯正終了',
  'リテーナーをつけて', 'マウスピース終了',
  '歯が綺麗になって', 'ホワイトニング終了',
  '詰め物を入れて', '根管治療終了',
  '親知らずを抜いて', 'インプラント終了',
  '被せ物をつけて', '入れ歯ができて',
  '銀歯が入って', '治療完了歯',
  '歯医者を卒業して', '半年検診終了',
];
const negate = [
  'still in braces', 'still wearing aligners',
  'まだ矯正中', 'まだ治療中',
];
const nullPins = [
  'about to get braces', 'mid root canal',
  'retainer', 'braces', 'aligner tray',
  '歯医者の途中', 'これから矯正',
  'リテーナー', '矯正器具', '型取りをして',
];
const establishedPins = [
  ['dentist tomorrow', 'date'], ['明日歯医者', 'defer'],
];

describe('pass CCCLXXVI: dental treatment & braces-off end idioms (sycamore)', () => {
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
