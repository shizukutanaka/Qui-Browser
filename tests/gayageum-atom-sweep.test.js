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
  // foster placement made & child-welfare intake done
  'foster placement made', 'child-welfare intake done',
];
const closeTabJa = [
  '乳児院', '児童心理治療施設',
  '一時保護所', '一時保護委託',
  '児童家庭支援センター', '認定こども園',
  '児童厚生員', '児童指導員',
  '児童心理司', '児童福祉法',
  '児童福祉審議会', '施設入所',
  '施設措置', '措置解除',
  '施設内虐待', '児童虐待通報',
  '虐待通告', '虐待防止法',
  '児童憲章', '要保護児童対策地域協議会',
  '要保護児童', '児童家庭課',
  '子ども家庭課', '児童センター',
];
const negate = [
  'still awaiting the facility placement',
  'まだ措置前', 'これから措置申請',
];
const nullPins = [
  'about to file a child consultation', 'about to visit the orphanage',
];
const establishedPins = [
  ['児童養護施設', 'close-tab'], ['母子生活支援施設', 'close-tab'],
  ['児童自立支援施設', 'close-tab'], ['児童相談所', 'close-tab'],
  ['児童発達支援', 'close-tab'], ['放課後等デイサービス', 'close-tab'],
  ['措置費', 'close-tab'], ['里親会', 'close-tab'],
  ['ファミリーホーム', 'close-tab'], ['面会交流', 'close-tab'],
  ['まだ入所前', 'negate'], ['これから相談', 'negate'],
];

describe('pass DCIX: child-welfare facility idioms (gayageum)', () => {
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
