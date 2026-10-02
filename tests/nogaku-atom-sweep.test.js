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
  // parental-leave application procedures done
  'parental leave filed', 'leave request approved',
  'childcare leave starts', 'benefit application done',
  'return date set', 'leave extended',
];
const closeTabJa = [
  '育休申請', '産休申請',
  '育児休業', '育休給付金',
  '休業届', '復帰予定',
  '育休延長', '男性育休',
  'パパ育休', '出産手当金',
  '育児休業給付', '職場復帰',
];
const negate = [
  'still applying for leave',
  'まだ育休中', 'これから育休',
];
const nullPins = [
  'mid leave',
  '申請中',
];
const establishedPins = [
  ['about to take leave', null],
];

describe('pass DVI: parental-leave application idioms (nogaku)', () => {
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
