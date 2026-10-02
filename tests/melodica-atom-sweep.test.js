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
  // volunteer insurance enrolled & relief deployment done
  'volunteer insurance enrolled', 'relief deployment done',
];
const closeTabJa = [
  '災害ボランティア', 'ボランティア保険',
  'ボランティア活動保険', '社会貢献活動保険',
  'ボランティアセンター', '災害救援ボランティア',
  '復興ボランティア', '被災地支援',
  'ボランティア証明書', 'ボランティア保険加入',
  '社会奉仕', 'ボランティア登録証',
  '活動証明書', 'ボランティア休暇',
  '職場ボランティア',
];
const negate = [
  'still unregistered as a volunteer',
  'まだ未加入', 'これから災害派遣',
];
const nullPins = [
  'about to deploy', 'about to enlist',
];
const establishedPins = [
  ['ボランティア証明', 'close-tab'],
];

describe('pass DLXVI: disaster-volunteer & insurance idioms (melodica)', () => {
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
  test.each(establishedPins)('"%s" keeps pin %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
