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
  // PTA-officer handover done (PTA役員・学校ボランティアの終了側)
  'pta role handed over', 'volunteer duty done',
  'flag duty done', 'board term ended',
  'handover notes sent', 'role passed on',
  'event committee done',
];
const closeTabJa = [
  'pta役員を終えて', '旗当番を終えて',
  '給食当番を終えて', '役員任期を終えて',
  '引き継ぎ資料を渡して', '次期役員に引き継いで',
  '実行委員を終えて', '当番表を回して',
  'ベルマーク集計を終えて',
];
const negate = [
  'still on the pta', 'about to hand over',
  'まだ役員中', 'これから引き継ぐ',
];
const nullPins = [
  'mid term', 'pta duties', 'school volunteer',
  '役員任期中', 'pta', '学校ボランティア',
];
const establishedPins = [
  ['lunch duty done', 'close-tab'],
  ['引き継ぎを終えて', 'close-tab'],
];

describe('pass CDLI: PTA-officer handover idioms (chub)', () => {
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
