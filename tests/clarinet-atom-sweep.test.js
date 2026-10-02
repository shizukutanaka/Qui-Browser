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
  // fire-prevention inspection & filing done
  'fire inspection passed',
];
const closeTabJa = [
  '防火管理者', '防火管理点検',
  '消防立入検査', '消防予防申請',
  '消防設備点検', '避難訓練実施',
  '火災予防運動', '防火管理講習',
  '防災管理新規講習', '消防計画',
  '防火対象物', '消防署予防課',
  '点検報告書', '危険物申請',
  '大量危険物', '少量危険物',
];
const negate = [
  'still awaiting the inspector',
  'まだ点検前', 'これから届出',
];
const nullPins = [
  'about to notify', 'about to file a report',
];
const establishedPins = [
  ['drill report filed', 'close-tab'],
  ['about to inspect', 'negate'],
];

describe('pass DLVIII: fire-prevention administration idioms (clarinet)', () => {
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
