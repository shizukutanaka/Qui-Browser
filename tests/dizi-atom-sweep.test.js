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
  // zoning designation made & development permit granted
  'zoning designation made', 'development permit granted',
];
const closeTabJa = [
  '都市計画法', '都市計画区域',
  '用途地域', '開発許可',
  '開発行為', '区画形質',
  '都市計画審議会', '地区計画',
  '高度地区', '防火地域',
  '景観地区', '風致地区',
  '緑地保全地区', '生産緑地',
  '市街化区域', '市街化調整区域',
  '都市計画道路', '都市施設',
];
const negate = [
  'still awaiting the development permit',
  'まだ開発許可前', 'これから開発申請',
];
const nullPins = [
  'about to apply for the development permit', 'about to rezone',
];
const establishedPins = [
  ['建ぺい率', 'close-tab'],
  ['容積率', 'close-tab'],
  ['事業認可', 'close-tab'],
  ['土地区画整理事業', 'close-tab'],
  ['保留地', 'close-tab'],
];

describe('pass DCI: city-planning & development-permit idioms (dizi)', () => {
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
  test.each(establishedPins)('pinned "%s" stays "%s"', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
