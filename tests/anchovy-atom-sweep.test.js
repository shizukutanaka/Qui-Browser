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
  // real-estate selling done (不動産売却の終了側)
  'valuation booked', 'agent chosen',
  'listing prepared', 'photos staged',
  'asking price set', 'decluttered house',
  'broker called', 'sold sign up',
];
const closeTabJa = [
  '査定を受けて', '仲介業者を決めて',
  '掃除を済ませて', '希望価格を決めて',
  '不用品を処分して', '売り出しを始めて',
  '引き渡しを終えて', '確定申告を終えて',
];
const negate = [
  'still selling', 'about to list',
  'まだ売り出し中', 'これから査定する',
];
const nullPins = [
  'mid sale', 'real estate', 'property listing',
  '売却中', '不動産売却', '物件売却',
];
const establishedPins = [
  ['appraisal done', 'close-tab'],
  ['cleaning done', 'close-tab'],
  ['写真を撮り終えて', 'close-tab'],
  ['売買契約を結んで', 'close-tab'],
];

describe('pass CDXLVI: real-estate selling idioms (anchovy)', () => {
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
