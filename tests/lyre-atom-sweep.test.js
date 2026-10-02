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
  // declutter & resale-shop errand done (不用品売却・処分の終了側)
  'stuff sold', 'donated the clothes',
  'books sold', 'furniture hauled',
  'listed it online', 'sold the bike',
  'bagged it all',
];
const closeTabJa = [
  '不用品を売って', '服をまとめて',
  '古着を出して', '本を売って',
  '出品して', 'リサイクルショップに持って',
  '家具を処分して',
];
const negate = [
  'still decluttering', 'about to donate',
  'まだ片付け中', 'これから処分する',
];
const nullPins = [
  'mid declutter', 'resale shop', 'yard stuff',
  '断捨離中', 'リサイクルショップ', '不用品',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['decluttered', 'close-tab'],
  ['storage unit emptied', 'storage-status'],
  ['買取に出して', 'close-tab'],
  ['メルカリに出して', 'close-tab'],
];

describe('pass CDLXIII: declutter & resale idioms (lyre)', () => {
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
