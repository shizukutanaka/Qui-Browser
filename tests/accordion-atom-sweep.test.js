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
  // pet registration & rabies vaccination done
  'dog registered', 'rabies shot done',
];
const closeTabJa = [
  '狂犬病予防注射', '犬の登録',
  '動物取扱業', '特定動物',
  'ペット飼育届', '動物愛護センター',
  '収容犬', 'マイクロチップ登録',
  '飼い主届出', '譲渡会',
  '動物愛護推進員', '犬鑑札',
  '注射済票', '飼育放棄',
  '動物愛護週間',
];
const negate = [
  'still unvaccinated',
  'まだ注射前', 'これから登録申請',
];
const nullPins = [
  'about to register the dog', 'about to foster',
];
const establishedPins = [
  ['still unregistered', 'negate'],
];

describe('pass DLXII: pet-registration & animal-welfare idioms (accordion)', () => {
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
