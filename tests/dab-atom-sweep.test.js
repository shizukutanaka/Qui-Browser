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
  // certification-exam done (資格試験の終了側)
  'exam sat', 'results posted',
  'score report in', 'cert mailed',
  'proctored exam done', 'toefl taken',
  'exam fee paid', 'retake passed',
];
const closeTabJa = [
  '検定を受けて', '試験に受かって',
  '合否が出て', 'スコアレポートが届いて',
  '資格証が届いて', '受験料を払って',
  '再受験に受かって', '簿記試験を受けて',
  '英検を受けて', '漢検を受けて',
];
const negate = [
  'still studying for the exam', 'about to sit the exam',
  'まだ試験勉強中', 'これから受験する',
];
const nullPins = [
  'mid exam prep', 'certification', 'exam prep',
  '試験勉強中', '資格試験', '受験料',
];
const establishedPins = [
  ['passed the exam', 'close-tab'],
];

describe('pass CDLIII: certification-exam idioms (dab)', () => {
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
