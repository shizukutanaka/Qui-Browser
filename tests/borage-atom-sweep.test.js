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
  // planting & repotting
  'planted the tomatoes', 'seedlings in',
  'pots repotted', 'garden bed made',
  'herbs planted',
  // soil & watering
  'watered everything', 'soil turned',
  'compost added',
  // garden started
  'started a garden', 'veggie patch done',
];
const closeTabJa = [
  'トマトを植えて', '鉢替えをして',
  '花壇を作って', 'ハーブを植えて',
  '水やりを終えて', '土を耕して',
  '堆肥を入れて', '家庭菜園を始めて',
  '畑を作って',
];
const negate = [
  'still planting', 'まだ植え付け中',
  'まだガーデニング中',
];
const nullPins = [
  'about to plant', 'mid planting',
  'seed packet', 'garden tools',
  'これから植え付け', '植え付けの途中',
  '種袋', '園芸道具',
];
const establishedPins = [
  ['still gardening', 'negate'],
  ['苗を植えて', 'close-tab'],
];

describe('pass CDXIV: gardening & veggie-patch idioms (borage)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
