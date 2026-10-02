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
  // probation-mentor commissioned & parole supervised
  'probation-mentor commissioned', 'parole supervised',
];
const closeTabJa = [
  '保護司', '更生保護',
  '保護観察', '社会復帰支援',
  '出所支援', '再犯防止',
  '更生保護施設', '保護司会',
  '保護司委嘱', '保護司研修',
  '面会報告', '帰住指導',
  '更生保護委員会', '奉仕月間',
  '釈放後支援',
];
const negate = [
  'still on parole',
  'まだ観察中', 'これから面談',
];
const nullPins = [
  'about to reintegrate', 'about to parole',
];
const establishedPins = [
  ['仮釈放', 'close-tab'], ['恩赦', 'close-tab'],
  ['まだ更生中', 'negate'],
];

describe('pass DLXVII: probation & rehabilitation idioms (theremin)', () => {
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
