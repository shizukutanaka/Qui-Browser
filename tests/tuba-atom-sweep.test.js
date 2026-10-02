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
  // neighborhood-officer handover done (自治会・班長の役職交代の終了側)
  'handed the badge', 'ledger handed over',
  'seal returned', 'notice posted',
  'board updated', 'new officer elected',
  'term done',
];
const closeTabJa = [
  '班長を交代して', '役を引き継いで',
  '任期を終えて', '印鑑を返して',
  '掲示板を更新して', '総会資料を作って',
  '引き継ぎメモを渡して', '後任を決めて',
];
const negate = [
  'still on the board', 'まだ班長中',
];
const nullPins = [
  'mid term', 'neighborhood officer', 'kairanban',
  '自治会役員', '町内会役', '班長',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['term ended', 'close-tab'],
  ['minutes filed', 'close-tab'],
  ['回覧板を回して', 'close-tab'],
  ['about to hand over', 'negate'],
  ['これから引き継ぐ', 'negate'],
];

describe('pass CDLVIII: neighborhood-officer idioms (tuba)', () => {
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
