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
  // karaoke end
  'karaoke done', 'karaoke over', 'last song sung',
  'sang my last song', 'room time up',
  'karaoke room emptied', 'out of the karaoke box',
  'mic returned karaoke', 'tambourine put away',
  'score flashed karaoke', 'free time karaoke done',
  // batting
  'batting cage done', 'buckets of balls done',
  // bowling
  'bowling done', 'tenth frame done', 'bowling over',
  'shoes returned bowling', 'rented shoes returned',
  'gutter ball last', 'strike finished the game',
  'bowling alley closed',
  // game center / arcade
  'game center done', 'arcade done',
  'coins all spent', 'tickets cashed',
  'cashed in tickets', 'prize counter closed',
  'crane game done', 'won a prize crane',
  'claw machine emptied', 'photo booth done karaoke',
  'purikura done', 'darts done', 'billiards done',
  'pool game done karaoke', 'table folded karaoke',
];
const closeTabJa = [
  'カラオケ終了', 'カラオケが終わって', 'カラオケを出て',
  'カラオケボックスを出て', '部屋を出てカラオケ',
  '最後の曲を歌って', '歌い納め', '延長なしで',
  '時間いっぱい歌って', 'マイクを置いて',
  'タンバリンをしまって', '採点が出て',
  'フリータイム終了',
  'ボウリング終了', 'ボウリングが終わって',
  '最終フレーム', '10フレーム終了',
  '貸し靴を返して', 'ボールを返して',
  'バッティングセンター終了', '最後の球を打って',
  'ゲーセンを出て', 'ゲームセンター終了',
  'コインを使い切って', 'メダルを使い切って',
  '景品と交換して', 'クレーンゲームで取って',
  'プリクラを撮って', 'ダーツ終了', 'ビリヤード終了',
];
const negate = [
  'still singing', 'まだカラオケ中', 'まだ歌ってる',
];
const nullPins = [
  'about to karaoke', 'mid karaoke', 'song list',
  'karaoke machine', 'hour left karaoke',
  'カラオケの途中', 'これからカラオケ',
  '曲リスト', 'カラオケの時間',
];
const establishedPins = [
  ['tokens spent', 'close-tab'],
  ['last pitch hit', 'speech-pitch-status'],
  ['karaoke tomorrow', 'date'], ['明日カラオケ', 'defer'],
];

describe('pass CCCLXI: karaoke & amusement end idioms (teak)', () => {
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
