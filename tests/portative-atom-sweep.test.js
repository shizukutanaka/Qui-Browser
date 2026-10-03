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
  // vaccine campaign launched & outbreak contained
  'vaccine campaign launched', 'outbreak contained',
];
const closeTabJa = [
  '感染症法', '指定感染症',
  '結核予防', '麻しん',
  '風疹', '予防接種法',
  '定期接種', '臨時接種',
  '衛生検査所', '保健センター',
  '検疫所', '食品衛生',
  '衛生統計', '疫学調査',
  'パンデミック', '緊急事態宣言',
  'まん延防止措置', '感染症対策',
  '感染者届出', '濃厚接触者',
  '潜伏期間', 'クラスター発生',
  '市中感染', '感染経路',
  '宿泊療養', '自宅療養',
  '抗ウイルス薬', '公衆衛生',
  '衛生学', '帰国者診断',
  '検疫隔離', '新型コロナ対応',
  'コロナワクチン',
];
const negate = [
  'still awaiting the health inspection',
  'まだ接種前', 'これから検診予約',
  'まだ消毒前',
];
const nullPins = [
  'about to file the outbreak report',
  'about to join the vaccine drive',
];

describe('pass DCLXII: public health & epidemic-control administration idioms (portative)', () => {
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
