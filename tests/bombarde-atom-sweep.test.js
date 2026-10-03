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
  // defense budget approved & base realignment done
  'defense budget approved', 'base realignment done',
];
const closeTabJa = [
  '防衛省', '自衛隊',
  '防衛装備庁', '統合幕僚監部',
  '陸上幕僚監部', '海上幕僚監部',
  '航空幕僚監部', '防衛施設庁',
  '防衛医科大学校', '駐屯地',
  '自衛隊法', '防衛計画',
  '防衛費', '防衛装備品',
  '防衛白書', '防衛整備計画',
  '基地対策', '防空識別圏',
  '防衛出動', '災害派遣',
  '治安出動', '警戒監視',
  '自衛官', '任期制隊員',
  '防衛記念章', '演習場',
];
const negate = [
  'still awaiting the defense review',
  'まだ入隊前', 'これから入隊',
];
const nullPins = [
  'about to file the base petition',
  'about to join the reserves',
];

describe('pass DCXXXVIII: defense & self-defense-force administration idioms (bombarde)', () => {
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
