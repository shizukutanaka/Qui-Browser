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
  // leaving parents' home
  'visited home', 'back from home', 'left the parents house',
  'left parents', 'said goodbye to mom', 'said goodbye to dad',
  'goodbye to the folks', 'folks dropped me off',
  'said our goodbyes', 'waved goodbye to family',
  'promised to visit again',
  // journey back
  'drove back home', 'drove home', 'headed back', 'headed home',
  'back in the city', 'back to the apartment',
  'train ride done', 'shinkansen ride done', 'bullet train done',
  'got off the train', 'arrived back', 'back from the country',
  'drive back done', 'flight home done', 'flew back home',
  'bus ride home done', 'last train home', 'caught the last train',
  'return journey done', 'trip back done',
  // visits / family
  'countryside visit done', 'hometown visit done',
  'visit to hometown done', 'family visit done', 'visited family',
  'saw the family', 'family reunion done', 'reunion over',
  'relatives left', 'holiday visit done', 'holiday home done',
  'christmas visit done', 'new years visit done',
  'summer visit done', 'golden week visit done', 'bon visit done',
  'went home for obon', 'visit wrapped up', 'long weekend done',
  'went back sunday',
  // grave / respects
  'family grave visited', 'grave visit done',
  'paid respects grave', 'ancestral grave done',
  // food / hospitality
  'parents fed us', 'mom cooked', 'ate moms cooking',
  'home cooked meal done',
  // packing / settling
  'suitcase packed home', 'luggage repacked',
  'souvenirs from home', 'packed the car home',
  'car loaded home', 'leftovers packed', 'unpacked from trip',
  // arrival confirmation
  'texted arrived safe', 'let them know im home',
  'safe arrival text', 'made it back home', 'back home safe',
];
const closeTabJa = [
  // 帰省終了
  '帰省終了', '帰省が終わって', '帰省を終えて', '実家を出て',
  '実家を後にして', '実家から帰って', '実家滞在終了',
  '里帰り終了', '親の家を出て', '実家訪問終了',
  '実家を出発して',
  // 会いに行った
  '家族に会ってきた', '親に会ってきた', '両親に会ってきた',
  '親孝行してきた', '両親と話して', '親と話してきた',
  '家族と過ごして', '実家を満喫して', '実家でゆっくりして',
  'のんびりしてきた',
  // 墓参り
  '墓参り終了', '墓参りしてきた', '先祖の墓を参って',
  // 時期
  'お盆帰省終了', 'お盆休み終了', '盆休み終了',
  '年末年始帰省終了', '正月帰省終了', 'gw帰省終了',
  '週末帰省終了',
  // 食事
  '母の料理を食べて', '実家の味を食べて', '手料理を食べて',
  '実家飯を食べて', '家族で食事して',
  // 見送り/帰路
  '親に見送られて', '駅まで送ってもらって',
  '新幹線に乗って', '特急に乗って', '帰りの新幹線',
  '車で帰って', '高速で帰って', '夜行バスで帰って',
  '終電で帰って', '最終便で帰って', '飛行機で帰って',
  // 帰宅/片付け
  'アパートに戻って', 'マンションに戻って',
  '一人暮らしに戻って', '荷解きを済ませて', '荷物を解いて',
  'お土産をもらって', '実家から荷物が届いて',
  // 到着連絡
  '着いたと連絡して', '無事着いたと連絡', '帰宅連絡して',
];
const negate = [
  'still visiting', 'still at parents', 'still at home',
  'まだ帰省中',
];
const nullPins = [
  'visit ongoing', 'mid visit', 'family time now',
  'weekend at parents', 'まだ実家にいる', '実家滞在中',
  '帰省の途中', '実家にいる', '実家で過ごしてる',
];
const establishedPins = [
  ['visit done', 'close-tab'], ['home again', 'close-tab'],
  ['everyone went home', 'close-tab'],
  ['お墓参りを済ませて', 'close-tab'],
  ['call me when you get there', 'device-apps'],
  ['parents tomorrow', 'date'], ['going home tomorrow', 'date'],
  ['明日帰省', 'defer'], ['明日出発実家', 'defer'],
];

describe('pass CCCXLV: hometown visit end idioms (maple)', () => {
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
