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
  // patent/trademark filing procedures done
  'patent filed', 'trademark registered',
  'application published', 'office action answered',
];
const closeTabJa = [
  '特許出願', '商標登録',
  '実用新案', '意匠登録',
  '出願公開', '審査請求',
  '拒絶理由通知', '応答期間',
  '分割出願', '優先権主張',
  '国際出願', 'pct出願',
  '登録査定', '拒絶査定',
  '特許料納付', '年金納付',
  '侵害警告', '先行技術調査',
  '弁理士相談', '出願人名義',
  '職務発明', '特許庁',
];
const negate = [
  'still drafting claims', 'about to file the application',
  'まだ審査請求前', 'これから出願',
];
const nullPins = [
  'mid examination',
];
const establishedPins = [];

describe('pass DXXIX: patent & trademark filing idioms (yotsudake)', () => {
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
