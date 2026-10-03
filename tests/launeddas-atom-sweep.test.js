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
  // pharmacy license granted & generic drug approved
  'pharmacy license granted', 'generic drug approved',
];
const closeTabJa = [
  '薬機法', '医薬品医療機器等法',
  '医薬品承認', '治験届',
  '臨床試験', '医薬品副作用',
  'pmda', '医薬品卸業',
  '薬局開設許可', '調剤薬局',
  '薬剤師会', '麻薬取締官',
  '向精神薬', '毒物劇物',
  '覚醒剤取締法', 'ジェネリック医薬品',
  '後発医薬品', '副作用被害救済',
  '拡大生産治験', 'オンライン服薬指導',
  '処方箋医薬品', '医療用医薬品',
  '一般用医薬品', '承認審査',
  '医薬品製造業',
];
const negate = [
  'still awaiting the drug approval',
  'まだ承認申請前', 'これから治験届',
];
const nullPins = [
  'about to file the clinical trial',
  'about to register the pharmacy',
];

describe('pass DCXXIX: pharmaceutical & drug administration idioms (launeddas)', () => {
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
