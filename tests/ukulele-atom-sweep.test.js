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
  // reemployment-support benefit granted / placement done
  'reemployment allowance granted', 'placed in a new job',
];
const closeTabJa = [
  '求職者支援', '就職促進手当',
  '常用就職支度手当', '就職支度金',
  '職業紹介', '職業相談',
  '求人票', '紹介状',
  '面接指導', '求職活動実績',
  '雇用継続給付', '再就職支援',
  '早期就職', 'ハローワーク紹介',
];
const negate = [
  'still looking for work',
  'まだ求職中', 'これから面接',
];
const nullPins = [
  'about to interview', 'about to resign',
];
const establishedPins = [
  ['再就職手当', 'close-tab'],
  ['失業認定', 'close-tab'],
];

describe('pass DLX: reemployment-support idioms (ukulele)', () => {
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
