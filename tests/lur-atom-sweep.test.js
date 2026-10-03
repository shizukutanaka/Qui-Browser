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
  // university grant approved & accreditation renewal done
  'university grant approved', 'accreditation renewal done',
];
const closeTabJa = [
  '国立大学法人', '大学設置基準',
  '大学入学共通テスト', '入試広報',
  '大学改革支援', '学位授与機構',
  '高等専門学校', '専修学校',
  '各種学校', '大学院',
  '学部設置', '学科設置',
  '教員養成課程', '教育研究力',
  '大学運営費交付金', '学生生活支援',
  '学生募集', '大学認証評価機関',
  '認証評価', '第三者評価',
  '大学院生支援', '私学助成',
  '私立学校助成', '学校法人',
  '学校法人経営', '定員管理',
  '入学定員', '大学設置認可',
  '大学入試センター', '国立高等専門学校',
  '公立大学', '大学情報公開',
  '大学評価',
];
const negate = [
  'still awaiting the university charter',
  'まだ認証前', 'これから設置認可',
  'これから評価提出',
];
const nullPins = [
  'about to file the accreditation review',
  'about to join the university consortium',
];
const establishedPins = [
  // already pinned negate — registered まだ認証前 instead
  ['まだ設置前', 'negate'],
];

describe('pass DCXLIX: higher-education & university administration idioms (lur)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
