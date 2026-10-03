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
  // condo/HOA management done (マンション管理の終了側)
  'hoa dues paid', 'assessment passed',
  'board elected', 'reserve funded',
  'repairs approved', 'rules amended',
  'proxy sent', 'minutes circulated',
  'bylaws updated',
];
const closeTabJa = [
  '管理費を払って', '管理組合の総会を終えて',
  '修繕積立金を払って', '理事会を終えて',
  '大規模修繕を終えて', '議案書を読んで',
  '委任状を出して', '管理規約を改正して',
  '議事録を回して', '会計報告を受けて',
];
const negate = [
  'still paying dues',
  'まだ管理費支払中', 'これから総会に出る',
];
const nullPins = [
  'mid hoa meeting', 'hoa fees', 'condo board',
  '修繕計画中', '管理組合', 'マンション管理会社',
];
const establishedPins = [
  ['hoa meeting done', 'close-tab'],
  ['about to vote', null],
];

describe('pass CDXLIX: condo/HOA management idioms (catfish)', () => {
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
