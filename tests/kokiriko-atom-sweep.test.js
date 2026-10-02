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
  // farmland conversion & field-inheritance procedures done
  'field inheritance filed', 'land registry updated',
  'heir division done', 'boundary survey done',
  'land use changed',
];
const closeTabJa = [
  '農地転用', '転用許可',
  '畑の相続', '農地相続',
  '地目変更', '登記簿謄本',
  '測量完了', '境界確定',
  '農業委員会', '農地法',
];
const negate = [
  'still converting farmland', 'about to convert',
  'まだ転用中', 'これから転用',
];
const nullPins = [
  'mid inheritance',
  '許可申請中', '相続協議中',
];
const establishedPins = [
  ['farmland conversion approved', 'about'],
  ['conversion pending', 'about'],
];

describe('pass DIII: farmland conversion & field-inheritance idioms (kokiriko)', () => {
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
