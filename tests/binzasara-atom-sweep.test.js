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
  // agricultural mutual-aid insurance procedures done
  'mutual aid enrolled', 'crop claim paid',
];
const closeTabJa = [
  '農業共済', '共済掛金',
  '農業保険', '収穫保険',
  '被害認定', '損害評価',
  '共済金', '掛金納付',
  '引受検査', '品質検査',
  'ほ場', '圃場',
  '作況', '作柄',
  '収量', '基準収量',
  '補償額', '保険期間',
  '加入申込', '加入記載',
  '目減り', '獣害',
  '風水害', '霜害',
  '雪害', '干害',
  '病虫害', '鳥獣害',
];
const negate = [
  'still inspecting the field', 'about to file the loss',
  'まだ収穫前', 'まだ評価中',
];
const nullPins = [
  'mid harvest report',
];
const establishedPins = [
  ['damage assessed', 'close-tab'],
  ['これから加入', 'negate'],
];

describe('pass DXXXV: agricultural mutual-aid insurance idioms (binzasara)', () => {
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
