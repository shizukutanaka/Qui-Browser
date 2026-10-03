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
  // movie / film end
  'movie over', 'watched the movie', 'film finished',
  'film over', 'watched the film', 'the movie is over',
  // series / streaming end
  'series finished', 'finished the series',
  'finale watched', 'watched the finale',
  'season finale done', 'watched the episode',
  'episode over', 'anime episode done',
  'last episode done', 'binged the series',
  'binge done', 'binged it',
  'watched it all', 'watched the whole thing',
  'streamed it', 'streamed the movie',
  // leaving the cinema
  'left the cinema', 'out of the theater',
  'theater emptied out',
  // concert / live end
  'encore done', 'last encore', 'concert over',
  'concert ended', 'gig over', 'live show done',
  'band done', 'set list done',
  'left the venue concert', 'after the concert',
  'merch line done',
];
const closeTabJa = [
  '映画を見終わって', '映画を観終わって',
  '鑑賞終了', '見終えた', '観終えた',
  '全話見て', '最終話を見て', '最終回を見て',
  '続きを見終わって', '一気見終了', 'イッキ見終了',
  'シリーズを見終わって', 'シーズンを見終わって',
  'エピソードを見て',
  'エンドロールが終わって', '字幕が流れ終わって',
  'ライブ終了', 'ライブが終わって',
  'コンサート終了', 'コンサートが終わって',
  'ライブを出て', 'アンコール終了',
  'アンコールが終わって', 'グッズ列を抜けて',
  '物販を買って',
];
const negate = [
  'still watching the movie', 'still at the concert',
  'まだ鑑賞中', 'まだライブ中',
];
const nullPins = [
  'about to watch', 'mid movie',
  'halfway through the movie', 'tickets', 'popcorn',
  'まだ映画を見てる', '映画の途中', 'これから映画',
  'チケット未着', 'ポップコーン',
];
const establishedPins = [
  ['movie ended', 'close-tab'],
  ['episode done', 'close-tab'],
  ['marathon done', 'close-tab'],
  ['cinema emptied', 'close-tab'],
  ['house lights up', 'close-tab'],
  ['映画が終わって', 'close-tab'],
  ['映画終了', 'close-tab'],
  ['映画館を出て', 'close-tab'],
  ['劇場を出て', 'close-tab'],
  ['movie tomorrow', 'date'],
  ['concert tomorrow', 'date'],
  ['明日映画', 'defer'], ['明日ライブ', 'defer'],
];

describe('pass CCCLVI: movie & concert viewing end idioms (orchid)', () => {
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
