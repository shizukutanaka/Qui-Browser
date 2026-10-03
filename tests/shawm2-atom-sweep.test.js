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
  // budget bill passed & supplementary budget approved
  'budget bill passed', 'supplementary budget approved',
];
const closeTabJa = [
  '財政法', '予算',
  '一般会計', '特別会計',
  '暫定予算', '当初予算',
  '予算案', '予算編成',
  '概算要求', '財政審',
  '財政制度等審議会', '財政健全化',
  '財政赤字', '国債発行',
  '国債残高', '建設国債',
  '赤字国債', '特例公債',
  '借換債', '政府保証債',
  '財政投融資', '財投債',
  '国庫', '国庫金',
  '国庫納付金', '国庫補助金',
  '交付金', '補助率',
  '概算払', '決算報告',
  '財政支出', '歳入歳出',
  '歳入', '歳出',
  '基礎的財政収支', 'プライマリーバランス',
  '財政規律', '中期財政見通し',
  '主計局', '主計官',
  '予算執行', '繰越明許',
  '不用額', '剰余金',
];
const negate = [
  'still awaiting the budget approval',
  'まだ予算成立前', 'これから概算要求',
  'まだ編成前',
];
const nullPins = [
  'about to table the budget',
  'about to file the treasury report',
];
const establishedPins = [];

describe('pass DCLX: fiscal & budget administration idioms (shawm2)', () => {
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
});
