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
  // fishing over
  'fishing done', 'fishing trip over', 'done fishing',
  'fished all day', 'lines out of the water', 'reeled in',
  'last cast done', 'final cast',
  // gear stowed
  'rod packed up', 'rods packed', 'reel put away',
  'reels stored', 'tackle box closed', 'tackle put away',
  'bait bucket emptied', 'cooler packed', 'packed up the gear',
  'gear packed', 'waders off', 'took off the waders',
  // catch released / kept
  'catch released', 'released the catch', 'catch and released',
  'threw it back', 'threw them back', 'tossed it back',
  'kept the catch', 'catch cleaned', 'fish cleaned',
  'fish filleted', 'filleted the catch',
  // results
  'creel full', 'limit caught', 'caught the limit',
  'got my limit', 'cooler full of fish', 'big one landed',
  'landed the big one', 'lunker landed', 'trophy caught',
  'personal best fish', 'pb bass', 'new personal best',
  // skunked
  'nothing bit', 'no bites', 'got skunked', 'skunked today',
  'blanked', 'went home empty handed', 'empty handed',
  'fish were not biting', 'bite stopped', 'fish stopped biting',
  // boat / spot departure
  'boat docked', 'docked the boat', 'boat on the trailer',
  'trailered the boat', 'boat out of water', 'left the lake',
  'left the river', 'left the pier', 'pier packed up',
  'ice fishing done', 'ice hut folded', 'fly fishing done',
  'deep sea trip done', 'charter done', 'charter trip over',
  'head boat done', 'sunset on the water', 'lake day done',
  'river day done',
];
const closeTabJa = [
  // 釣り終了
  '釣り終了', '釣りが終わって', '釣りを終えて', '釣行終了',
  '釣り終わり', '釣りを切り上げて',
  // 道具仕舞い
  '竿を仕舞って', '竿仕舞い', '竿を畳んで', 'リールをしまって',
  '仕掛けを畳んで', 'タックルを片付けて',
  'クーラーボックスを閉めて', '釣り道具を片付けて',
  '釣具をしまって', 'エサを片付けて', '撒き餌を止めて',
  // リリース/持ち帰り
  '魚をリリースして', 'リリースして', '逃がしてあげて',
  'キャッチアンドリリース', '魚を持ち帰って',
  '釣果を持ち帰って', '魚を締めて', '魚を捌いて',
  '魚を三枚に下ろして',
  // 釣果
  '釣果ゼロ', '坊主で終わって', 'ボウズ', 'ボーズで終わって',
  '釣れなかった', '食いが止まって', 'アタリが止まって',
  '魚の食いが落ちて', '大物を釣って', '大型を釣って',
  '自己記録更新釣り', '自己ベスト釣り', '満腹の釣果',
  'クーラー満タン', '満タンで帰って',
  // 釣り場離脱
  '船から降りて', '渡船を降りて', '釣り船を降りて',
  '堤防を離れて', '防波堤を出て', '磯を降りて',
  '磯釣り終了', '渓流釣り終了', '湖を離れて',
  '釣り場を離れて', '夜釣り終了', '朝マヅメ終了',
  '夕マヅメ終了', 'へらぶな釣り終了', 'バス釣り終了',
  '海釣り終了', '川釣り終了',
];
const negate = [
  'still fishing', 'still out fishing', 'more casts',
  'one more cast', '釣りを続けて', 'もう一投して',
];
const nullPins = [
  'fishing ongoing', 'mid fishing', 'on the water now',
  'lines still in', 'lines in', 'went fishing',
  'head to the lake', 'ラストキャスト', 'まだ釣り中',
  '釣りの途中', '出船中',
];
const establishedPins = [
  ['fishing tomorrow', 'date'], ['lake tomorrow', 'date'],
  ['明日釣り', 'defer'],
  ['釣りに行って', 'go-to'], ['釣りに行ってきて', 'go-to'],
  ['何も釣れずに', 'negate'],
];

describe('pass CCCXLVI: fishing trip end idioms (iris)', () => {
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
