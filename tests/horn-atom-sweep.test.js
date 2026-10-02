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
  // parenting-support center & playgroup visits done
  'playgroup attended', 'spot confirmed',
];
const closeTabJa = [
  'こども家庭センター', '児童家庭相談所',
  '育児相談', '子育てコンシェルジュ',
  'こども食堂', '子育て広場',
  '育児サークル', '親子ひろば',
  'つどいの広場', '地域子育て支援拠点',
  '赤ちゃんひろば', 'ハローベビー',
  '妊婦相談', '産後ケア',
  '母子健康手帳', '乳幼児健診',
  '育児パッケージ', '子ども見守り',
];
const negate = [
  'still waiting for a spot',
  'これから参加',
];
const nullPins = [
  'about to join', 'about to sign up',
];
const establishedPins = [
  ['open house visited', 'go-to'],
  ['まだ相談前', 'negate'],
];

describe('pass DLIII: parenting-support & playgroup idioms (horn)', () => {
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
