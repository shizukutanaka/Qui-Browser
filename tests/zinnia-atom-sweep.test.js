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
  // dining out end
  'ate out', 'dinner out done', 'dinner done eating',
  'finished dinner out', 'finished eating out',
  'left the restaurant', 'out of the restaurant',
  'restaurant done',
  // bill / tip
  'paid the bill', 'got the check', 'bill paid',
  'check paid', 'split the check', 'tipped the waiter',
  'left a tip',
  // courses / full
  'dessert done', 'had dessert', 'last course done',
  'finished the meal', 'meal done eating',
  'lunch done eating', 'brunch done', 'buffet done',
  'all you can eat done', 'went back for seconds',
  'plate empty', 'cleaned my plate', 'food coma',
  'stuffed', 'could not eat another bite',
  // takeout / late eats
  'takeout done', 'got takeout', 'takeout picked up',
  'drive thru ate', 'ate in the car',
  'late night ramen done', 'izakaya done',
  'drinks done bar', 'last round had', 'bar tab paid',
  'closed the tab bar', 'happy hour over',
];
const closeTabJa = [
  '外食終了', '外食が終わって', '食事が済んで',
  'お食事終了', 'ご飯を食べてきて',
  'ご飯を食べ終わって', '食べてきて',
  'お腹いっぱい', '腹一杯', '満腹',
  '皿を空にして', 'お代わりをして', 'お替りをして',
  'デザートを食べて', 'お勘定をして',
  '割り勘にして', 'チップを置いて',
  '飲食店を出て', 'レストランを出て',
  '居酒屋を出て', 'カフェを出て', '喫茶店を出て',
  '牛丼屋を出て', 'ラーメン屋を出て',
  '締めのラーメンを食べて', '飲み屋を出て',
  'テイクアウトを買って', '食べ放題終了',
  'バイキング終了', 'ラストオーダー終わって',
];
const negate = [
  'still eating out', 'still at the restaurant',
  'まだ食事してる', 'まだ食べてる',
];
const nullPins = [
  'about to eat out', 'mid meal', 'waiting for the food',
  '食事の途中', 'これから食事', '注文待ち',
];
const establishedPins = [
  ['split the bill', 'close-tab'],
  ['course done', 'close-tab'],
  ['完食して', 'close-tab'],
  ['残さず食べて', 'close-tab'],
  ['お持ち帰りにして', 'close-tab'],
  ['menu', 'settings-toggle'], ['メニュー', 'settings-toggle'],
  ['dinner tomorrow', 'date'],
  ['明日外食', 'defer'],
];

describe('pass CCCLVIII: dining-out end idioms (zinnia)', () => {
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
