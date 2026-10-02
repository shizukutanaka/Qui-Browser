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
  // self-reliance support program procedures done
  'support plan approved',
];
const closeTabJa = [
  '生活困窮者自立支援', '自立相談支援',
  'すまいサポート', '住宅入居支援',
  '就労サポート', '一時生活支援',
  '家計改善支援', '就労準備支援',
  '学習支援', '子どもの学習支援',
  '相談支援員', '支援員',
  '支援プラン', 'プラン策定',
  '食料支援', '住居確保給付金',
  '自立促進', 'ハローワーク連携',
  'ファミリーサポート', '訪問相談',
  '生活支援', 'アドバイザー',
  '相談窓口', '生活サポート',
  '支援終了', '自立達成',
  '自立指標',
];
const negate = [
  'まだ相談中', 'これから相談',
  'まだ支援中',
];
const nullPins = [
  'mid interview',
];
const establishedPins = [
  ['consultation done', 'close-tab'],
  ['housing support granted', 'close-tab'],
  ['自立支援計画', 'close-tab'],
  ['still under review', 'negate'],
];

describe('pass DXL: self-reliance support program idioms (tsutsumi)', () => {
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
