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
  // research grant awarded & paper peer-reviewed
  'research grant awarded', 'paper peer-reviewed',
];
const closeTabJa = [
  '科学技術庁', '科学技術政策',
  '日本学術会議', '科研費',
  '科学研究費補助金', '研究助成',
  '学術振興', '学術賞',
  '研究倫理', '論文査読',
  '学会発表', '学術誌',
  '博士課程', '修士課程',
  '研究室', '実験施設',
  '国研', '理研',
  '物質材料研究機構', '宇宙研究機構',
  '極地研究所', '国立天文台',
  '大学共同利用機関', '産学連携',
  '産学官', '技術移転機構',
  '大学発ベンチャー', '研究成果',
  '知財管理', '発明届出',
  '特許許諾', '技術移転',
  '日本産業規格', '計量標準',
  '国家標準', '計量法',
];
const negate = [
  'still awaiting the grant review',
  'まだ論文提出前',
];
const nullPins = [
  'about to file the invention disclosure',
  'about to join the research consortium',
];
const establishedPins = [
  ['職務発明', 'close-tab'],
  ['まだ採択前', 'negate'],
  ['これから申請', 'negate'],
];

describe('pass DCLXV: science & academic research administration (rhea)', () => {
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
