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
  // tourism zone designated & dmo registered
  'tourism zone designated', 'dmo registered',
];
const closeTabJa = [
  '観光立国', '観光基本法',
  '観光圏', '観光地域づくり',
  '観光客誘致', '観光需要創出',
  '観光庁', '旅行業法',
  '旅行業者', '登録旅行業者',
  '旅行業登録', 'ランドオペレーター',
  '観光大使', 'おもてなし',
  '訪日客', 'インバウンド観光',
  'オーバーツーリズム', '観光公害',
  '観光マナー', '宿泊税',
  '観光案内所', '観光スポット',
  '観光地経営', '観光連盟',
  'dmo', '観光地域づくり法人',
  '地域観光資源',
];
const negate = [
  'still awaiting the tourism designation',
  'これから旅行業登録',
];
const nullPins = [
  'about to register the travel agency',
  'about to join the dmo',
];
const establishedPins = [
  ['まだ登録前', 'negate'],
];

describe('pass DCXXIV: tourism-policy & sightseeing-economy idioms (hne)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
