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
  // adoption & pickup
  'adopted a dog', 'brought the puppy home',
  'adoption done', 'picked up the cat',
  // vet & registration
  'vaccinations done', 'microchipped',
  'registered the dog', 'pet insurance done',
  // settling in
  'first night home', 'crate set up',
];
const closeTabJa = [
  '犬を迎え入れて', '子犬を連れて帰って',
  '里親になって', '猫を拾って',
  'ワクチンを打って', 'マイクロチップを入れて',
  '登録を済ませて', 'ペット保険に入って',
  '最初の夜を過ごして', 'ケージを組み立てて',
];
const negate = [
  'still looking for a pet', 'still waiting for the puppy',
  'まだペット探し中', 'まだ里親待ち',
];
const nullPins = [
  'about to adopt', 'mid adoption',
  'adoption papers', 'pet carrier',
  'これから迎え入れ', '手続きの途中',
  '譲渡書', 'ペットキャリー',
];
const establishedPins = [];

describe('pass CDXIII: pet adoption & welcome-home idioms (aster)', () => {
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
