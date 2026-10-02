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
  // disability certificate & pension filing done (障害者手帳・障害年金の終了側)
  'disability certificate issued', 'disability pension filed',
  'handbook issued', 'grade certified',
  'mental disability grade', 'physical disability filed',
  'rehabilitation card', 'disability benefits',
  'welfare card issued',
];
const closeTabJa = [
  '障害者手帳', '障害年金',
  '精神障害者手帳', '身体障害者',
  '療育手帳', '認定調査',
  '自立支援医療', '障害等級',
  '障害福祉',
];
const negate = [
  'still assessing', 'about to certify',
  'まだ認定中', 'これから認定',
];
const nullPins = [
  'mid examination', '更新時期',
];
const establishedPins = [];

describe('pass CDLXXXV: disability-certificate & pension idioms (biwa)', () => {
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
