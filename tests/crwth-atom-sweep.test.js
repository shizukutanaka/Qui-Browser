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
  // rehired after retirement & silver center joined
  'rehired after retirement', 'silver center joined',
];
const closeTabJa = [
  '定年延長', '継続雇用',
  '再雇用', '高年齢者雇用安定法',
  '高齢者雇用', 'シルバー人材センター',
  'シルバー人材', '高齢者就業',
  '就業促進', '雇用延長',
  '退職後再雇用', '生涯現役',
  'エイジレス', '高年齢雇用継続給付',
  '高年齢者等就業促進', '高齢労働者',
  '定年後', '高齢者再就職',
];
const negate = [
  'still before rehiring',
  'まだ再雇用前', 'これから延長申請',
];
const nullPins = [
  'about to extend the retirement age', 'about to join the silver center',
];
const establishedPins = [
  ['再就職支援', 'close-tab'],
];

describe('pass DXCV: senior-employment & rehiring idioms (crwth)', () => {
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
