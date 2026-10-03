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
  // residence permit granted & work permit issued
  'residence permit granted', 'work permit issued',
];
const closeTabJa = [
  // 技能実習・特定技能
  '技能実習生', '技能実習制度',
  '特定技能', '特定技能1号',
  '特定技能2号', '技能実習責任者',
  '監理団体', '登録支援機関',
  '送り出し機関', '外国人技能実習機構',
  '技能実習計画', '技能実習修了',
  // 外国人材・在留
  '外国人材', '外国人労働者',
  '高度人材', '高度専門職',
  '在留期間更新', '在留資格変更',
  '資格外活動許可', '難民申請',
  // 留学・特定活動
  '日本語教育機関', '留学生',
  '留学ビザ', '特定活動ビザ',
  '技術・人文知識・国際業務',
  // 身分・共生
  '日本人配偶者', '永住者配偶者',
  '定住者', '日系人',
  '日本人デカセギ', '外国人住民',
  '多文化共生', '共生社会',
  '国際交流',
];
const negate = [
  'still awaiting the visa decision',
  'まだ入国前', 'これから入国',
];
const nullPins = [
  'about to file the residence application',
  'about to visit the immigration office',
];
const establishedPins = [
  ['visa renewed', 'close-tab'],
  ['residence card issued', 'close-tab'],
  ['在留カード', 'close-tab'],
  ['まだ申請前', 'negate'],
  ['これから申請', 'negate'],
];

describe('pass DCLXXVI: technical-intern & foreign-worker administration (sherpa)', () => {
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
