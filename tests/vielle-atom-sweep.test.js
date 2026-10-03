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
  // fishing quota allocated & harbor works approved
  'fishing quota allocated', 'harbor works approved',
];
const closeTabJa = [
  '水産庁', '水産基本法',
  '漁港計画', '養殖業',
  '沿岸漁業', '沖合漁業',
  '遠洋漁業', '漁船保険',
  '魚価安定', '水産物検査',
  '輸出水産物', '鮮魚市場',
  '水産加工業', '魚市場運営',
  '海の駅', '沿岸漁場',
  '栽培漁業', '種苗生産',
  '稚魚放流', '資源管理評価',
  '漁獲割当', '総漁獲可能量',
  '密漁取締り', '遊漁船業',
  '鯨類資源', '海洋調査',
];
const negate = [
  'still awaiting the fishing permit',
  'まだ操業前', 'これから出漁',
];
const nullPins = [
  'about to file the catch report',
  'about to join the fish co-op',
];
const establishedPins = [
  // already pinned close-tab — registered 漁港計画 instead
  ['漁港整備', 'close-tab'],
];

describe('pass DCXLIV: fisheries administration idioms (vielle)', () => {
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
