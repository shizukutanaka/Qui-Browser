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
  // estate & probate
  'will signed', 'estate settled',
  'probate done', 'inheritance split',
  'executor duties done', 'estate closed',
  'letters testamentary filed', 'will reading done',
  'survived the will reading',
  // legal prep / directives
  'advance directive done', 'power of attorney done',
  'trust funded', 'living will done',
  'dnr signed',
  // arrangements & belongings
  'grave plot bought', 'funeral prearranged',
  'life insurance filed', 'death cert filed',
  'accounts closed deceased', 'belongings sorted',
  'estate sale done', 'heirlooms distributed',
  // memorial end
  'last rites done', 'memorial service done',
  'wake done', 'ashes interred',
  'headstone set', 'condolences sent',
  'mourning ended',
];
const closeTabJa = [
  '終活終了', '遺言書を書いて',
  '相続手続き終了', '遺産分割協議終了',
  '墓を買って', '葬儀を予約して',
  '生前整理終了', '実家の断捨離終了',
  '保険金請求終了', '死亡届を出して',
  '口座を解約して故人', '遺品整理終了',
  '戒名をつけて', '納骨を終えて',
  '四十九日終了', '一周忌終了',
  '香典返しを送って', '喪中を終えて',
  'お墓参りを終えて', '永代供養を申し込んで',
  'エンディングノートを書いて', '財産目録を作って',
  '遺族年金手続き終了', '名義変更をして墓',
  '葬儀社を決めて', '棺を納めて',
];
const negate = [
  'still in probate', 'still sorting belongings',
  'まだ相続手続き中', 'まだ遺品整理中',
];
const nullPins = [
  'about to settle estate', 'mid probate',
  'will document', 'safe deposit box', 'family plot',
  '相続の途中', 'これから相続',
  '遺言書', 'エンディングノート',
];
const establishedPins = [
  ['ashes scattered', 'close-tab'],
  ['相続税申告終了', 'close-tab'],
  ['法事が終わって', 'close-tab'],
  ['probate tomorrow', 'date'], ['明日法事', 'defer'],
];

describe('pass CCCLXXIV: estate & memorial-service end idioms (juniper)', () => {
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
