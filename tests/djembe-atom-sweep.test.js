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
  // dementia cafe attended & supporter trained
  'dementia cafe attended', 'dementia-supporter trained',
];
const closeTabJa = [
  '認知症カフェ', 'オレンジカフェ',
  '認知症初期集中支援チーム', '認知症地域支援推進員',
  'もの忘れ相談', '認知機能評価',
  '家族介護教室', '介護者教室',
  '認知症サポーター養成', 'オレンジパートナー',
  '徘徊見守り', '認知症対応型デイ',
  '認知症サポーター', 'オレンジプラン',
  'アルツハイマー月間',
];
const negate = [
  'still awaiting assessment',
  'まだ介護前', 'これから認定審査',
];
const nullPins = [
  'about to wander off', 'about to forget',
];
const establishedPins = [];

describe('pass DLXX: dementia-cafe & early-support idioms (djembe)', () => {
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
