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
  // rehearsal end
  'band practice done', 'rehearsal over',
  'rehearsal wrapped', 'run through done',
  'dress rehearsal done', 'read through done',
  'table read done', 'sectionals done',
  // pack-up / strike
  'orchestra tuned down', 'setlist done',
  'setlist nailed', 'packed the amp',
  'gear loaded', 'amp packed',
  'drum kit struck',
  // studio / recording
  'jam session over', 'jammed out',
  'laid down the track', 'track laid down',
  'demo recorded', 'takes done recording',
  'studio session over',
  // theatre / dance prep
  'blocked the scene', 'moved off book',
  'off book now', 'choreography learned',
  'dance rehearsal done',
];
const closeTabJa = [
  'バンド練習終了', '練習を終えてバンド',
  'リハ終了', '通し稽古終了',
  'ゲネ終了', 'ゲネプロ終了',
  '本読み終了', 'セッション終了',
  '譜面台を畳んで',
  '弦を緩めて', 'チューニングを下げて',
  '機材を積んで', '機材搬出',
  '搬出が終わって', '楽屋を出て',
  'セットリストを終えて', '曲を終えて',
  'レコーディング終了', 'テイクを録って',
  'デモを録って', 'ダンス練習終了',
  '振り付けを覚えて', '合唱練習終了',
  'パート練習終了', 'オーケストラ練習終了',
];
const negate = [
  'still rehearsing', 'still jamming',
  'まだリハ中', 'まだ練習中',
];
const nullPins = [
  'about to rehearse', 'mid rehearsal',
  'sheet music', 'set list', 'gig bag',
  'amp room',
  '練習の途中', 'これからリハ',
  '譜面', '楽屋口', 'アンプ',
];
const establishedPins = [
  ['rehearsal done', 'close-tab'],
  ['mic off stage', 'stop'],
  ['green room emptied', 'close-tab'],
  ['リハーサル終了', 'close-tab'],
  ['スタジオを出て', 'close-tab'],
  ['楽器をしまって', 'close-tab'],
  ['アンプを切って', 'close-tab'],
  ['rehearsal tomorrow', 'date'], ['明日リハ', 'defer'],
];

describe('pass CCCLXVIII: band rehearsal & studio end idioms (poplar)', () => {
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
