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
  // union card signed & collective agreement ratified
  'union card signed', 'collective agreement ratified',
];
const closeTabJa = [
  '労働基準法', '労働基準監督官',
  '労働局', 'ハローワーク',
  '労使協定', '三六協定',
  '変形労働時間', '裁量労働制',
  'みなし労働時間', '休日労働',
  '深夜労働', '時間外手当',
  '年次有給休暇', '介護休業',
  '生理休暇', '産前産後休業',
  '労働安全衛生法', '過労死',
  '職場のいじめ', 'ハラスメント',
  '妊娠解雇', '労働組合法',
  '労働争議', 'ピケット',
  '解雇理由', '労働者災害',
  '労災保険', '賃金未払',
  '未払賃金', '最低賃金',
  '退職金', '雇用契約書',
  '常用労働者', '短時間労働者',
  '契約社員', '嘱託社員',
  '有期雇用', '無期転換',
  '雇止め', '均等待遇',
  '非正規労働者',
];
const negate = [
  'still awaiting the union recognition',
  'まだ団交前', 'まだ協定前',
  'これから届',
];
const nullPins = [
  'about to join the labor union',
  'about to file the grievance',
];
const establishedPins = [
  ['これから団交', 'negate'],
];

describe('pass DCLVIII: labor & employment administration idioms (didgeridoo)', () => {
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
