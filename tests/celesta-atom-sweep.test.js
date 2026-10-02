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
  // sign permit granted & illegal billboard removed
  'sign permit granted', 'illegal billboard removed',
];
const closeTabJa = [
  '屋外広告物', '広告板',
  '許可申請', '表示面積',
  '広告料', '広告条例',
  '違反広告物', '除却',
  '看板設置', '袖看板',
  '突出し看板', '電柱広告',
  '旗竿広告', '野立て看板',
  '簡易広告', '広告主',
];
const negate = [
  'still unlicensed for the sign',
  'まだ許可前', 'まだ設置前',
];
const nullPins = [
  'about to hang the sign', 'about to raise the billboard',
];

describe('pass DLXXX: outdoor-advertising & signboard idioms (celesta)', () => {
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
