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
  // agency evaluation published & corporation charter approved
  'agency evaluation published', 'corporation charter approved',
];
const closeTabJa = [
  '独立行政法人', '国立病院機構',
  '労働者健康安全機構', '日本年金機構',
  '産業技術総合研究所', 'jaxa',
  '日本学術振興会', '国立研究開発法人',
  '特殊法人', '認可法人',
  '外郭団体', '国家公務員',
  '国家公務員採用', '総合職試験',
  '一般職試験', '幹部候補',
  '定年退官', '官民人材',
  '人事交流', '天下り',
  '再就職等監視', '行政改革',
  '行革', '省庁再編',
  '庁舎移転', '政策評価',
  '行政評価局', '独立行政法人評価',
  '中期目標', '中期計画',
  '年度計画', '運営費交付金',
  '施設費交付金', '機能別会計',
  '法人化', '司法支援センター',
];
const negate = [
  'still awaiting the agency evaluation',
  'まだ認可前', 'これから中期計画',
  'これから設立届',
];
const nullPins = [
  'about to file the corporation report',
  'about to join the research agency',
];
const establishedPins = [
  // already pinned — kept green
  ['まだ評価前', 'negate'],
];

describe('pass DCLIII: incorporated-administration & civil-service idioms (cornu)', () => {
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
