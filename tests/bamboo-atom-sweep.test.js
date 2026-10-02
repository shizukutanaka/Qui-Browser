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
  // descent / back at base
  'hiking done', 'back down the mountain',
  'came down the mountain', 'descended',
  'down the mountain', 'back at the trailhead',
  // gear off
  'took off the boots', 'gear packed mountain',
  'pack emptied', 'poles collapsed',
  // summit / route
  'trekking done', 'trek done', 'summit done',
  'mountain done', 'ridge done', 'loop done trail',
  'out and back done', 'shelter reached',
  'hut reached', 'mountain hut stayed',
  // after-hike soak
  'onsen after hike', 'hot spring after',
  'soaked after the hike',
  // ski day
  'ski day done', 'skiing done', 'lifts closed',
  'last run done', 'final run ski', 'skis off',
  'boots unbuckled', 'lodge back', 'back at the lodge',
  'hot cocoa after', 'après ski done', 'slope done',
  'lift tickets done', 'day pass used up',
  'ski trip done', 'snow day done',
];
const closeTabJa = [
  'ハイキング終了', 'ハイキングが終わって',
  '登山が終わって', '下山して', '下山届を出して',
  '山小屋を出て', '山小屋に泊まって',
  '登山靴を脱いで', '杖をしまって',
  'リュックを下ろして',
  '山頂を踏んで', '登頂して', '制覇して',
  '稜線を歩き終えて', '縦走終了', '下山後の温泉',
  'スキー終了', 'スキーが終わって',
  'リフトが終わって', '最終滑走', '滑り納め',
  '板を脱いで', 'スキーブーツを脱いで',
  'ロッジに戻って', 'ゲレンデを後にして',
  'リフト券を使い切って', '雪山を下りて',
];
const negate = [
  'still hiking', 'still on the mountain',
  'まだ登山中', 'まだハイキング中',
];
const nullPins = [
  'about to hike', 'mid hike', 'trail map',
  'hiking boots', '登山の途中', 'これから登山',
  '登山靴', '山の途中',
];
const establishedPins = [
  ['hike done', 'close-tab'],
  ['made it down', 'close-tab'],
  ['trailhead back', 'close-tab'],
  ['boots off', 'close-tab'],
  ['peak bagged', 'close-tab'],
  ['mountain climbed', 'close-tab'],
  ['登山終了', 'close-tab'], ['山を下りて', 'close-tab'],
  ['下山完了', 'close-tab'],
  ['登山口に戻って', 'close-tab'],
  ['装備をしまって', 'close-tab'],
  ['halfway up', 'half-page-back'],
  ['hike tomorrow', 'date'], ['明日登山', 'defer'],
];

describe('pass CCCLX: hike & ski-day end idioms (bamboo)', () => {
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
