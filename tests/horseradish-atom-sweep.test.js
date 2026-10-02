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
  // new-job settling & onboarding
  'first week survived', 'settled into the new job',
  'probation review passed', 'three month mark hit',
  'learned the ropes', 'team lunch done',
  'intro meetings done', 'accounts set up',
];
const closeTabJa = [
  '初週を終えて', '新しい職場に慣れて',
  '試用期間を終えて', '三ヶ月を越えて',
  '仕事を覚えて', 'チームランチをして',
  '顔合わせを終えて', '社員証をもらって',
  'アカウントを作って', 'メンターがついて',
];
const negate = [
  'still ramping up', 'still learning the codebase',
  'まだ立ち上げ中', 'まだコードを理解中',
];
const nullPins = [
  'about to start the new job', 'mid onboarding',
  'onboarding checklist', 'team wiki',
  'これから出社', '研修の途中',
  'オンボーディング表', '社内wiki',
];
const establishedPins = [
  ['badge issued', 'close-tab'],
  ['mentor assigned', 'close-tab'],
];

describe('pass CDXX: new-job settling & onboarding idioms (horseradish)', () => {
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
