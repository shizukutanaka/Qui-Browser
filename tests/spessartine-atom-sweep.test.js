// Voice atoms CCCIII: EN camp/teardown + concert-end idioms + JA 撤収/下山/演奏終了 chains (pass CCCIII)
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ title: 'Example Page', url: 'https://example.com' }),
    closeTab: () => {},
    tabs: [{ title: 'Example Page' }],
  });
  return vc;
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

const closeTab = [
  // --- camp teardown / strike ---
  'strike camp', 'break camp', 'pack up camp', 'camp packed',
  'decamp', 'decamp it', 'fold the tent', 'roll the tent',
  'tent down', 'poles down', 'take down the tent', 'douse the fire',
  'put out the campfire', 'dead out', 'cold ashes', 'ashes cold',
  'wet the ashes', 'stir the ashes dead', 'smother the fire',
  'fire watch done', 'bear bag down', 'leave no trace', 'trace erased',
  // --- gear stow / roll home ---
  'hang the pack', 'boots off', 'roll the sleeping bag', 'stow the gear',
  'store the gear', 'gear stowed', 'pack the mule', 'load the canoe',
  'canoe loaded', 'paddle home', 'home by dark', 'last night out',
  // --- trail/summit end ---
  'end of the trail', 'the trails end', 'trail ends here',
  'off the mountain', 'come off the mountain', 'back down',
  'rappel down', 'off belay', 'hike over', 'hike done', 'day hike done',
  'out of the woods', 'made it out', 'back to trailhead',
  'trailhead reached', 'camp broke', 'site cleaned', 'clean camp',
  'bagged the peak', 'summit bagged', 'bagged it', 'tagged the summit',
  // --- concert end / strike the stage ---
  'encore over', 'no more encores', 'last song', 'final number',
  'closing number', 'dropped the mic', 'drop the mic', 'unplug it',
  'kill the amp', 'amps off', 'power down the pa', 'wrap the set',
  'the set is done', 'play them out', 'play it off', 'outro plays',
  'the outro plays', 'final chord', 'last note', 'roadies load out',
  'load out done', 'strike the stage', 'band packed up',
  'house music on', 'amps to the truck',
];

const closeTabJa = [
  // --- キャンプ撤収 ---
  '撤収する', 'キャンプ撤収', 'テントを畳んで', 'テント畳み',
  'ポールを外して', 'ペグを抜いて', 'タープを畳んで',
  '焚き火を消して', '完全消火', '消し炭', '火の始末',
  '水をかけて消して', '灰を冷まして', '炭を片付けて',
  'シュラフを畳んで', '寝袋をしまって', '装備をしまって',
  'ギアをしまって', '荷造りして', '原状回復して', '跡を消して',
  'サイトを掃除して', 'キャンプ終わり', '最後の夜', '帰路につこう',
  // --- 下山/登山終了 ---
  '下山', '下山します', '山を下りて', '尾根を下りて', '登山終了',
  '山行終了', '登頂完了', '頂上制覇', '下山完了', '登山口に戻って',
  '撤収にして',
  // --- 演奏終了 ---
  '演奏終了', '楽屋撤収', 'ステージ撤収', '最終曲', 'ラストナンバー',
  'ラストソング', '鳴り止んだ', '演奏を畳んで', 'アンコール終わり',
  'アンプを切って', 'PAを落として', 'セットリスト終わり',
  'セトリ終わり', '楽器をしまって', 'ケースにしまって', '最後の音',
  '余韻が消えた',
];

const negate = [
  'keep the fire going', 'stay on the trail', 'keep climbing',
  'keep playing', 'まだ登ってる', '山に残って', '演奏を続けて',
  'still touring',
];

const nullPins = [
  // set-up / ongoing — not teardown
  'bank the fire', 'rope up', 'summit bid', 'base camp',
  'pitch the tent', 'set up camp', 'tune the guitar', 'sound check',
  'first song', 'アンコール',
  '焚き火を起こして', 'テントを張って',
  '登山開始', '登り始めて', 'サウンドチェック', 'リハーサル',
  'チューニングして',
];

const establishedPins = [
  ['撤収', 'close-tab'],
  ['撤収して', 'close-tab'],
  ['encore please', 'repeat-command'],
  ['もう一回', 'say-again'],
  ['消音して', 'mute-toggle'],
  ['無音にして', 'mute-toggle'],
];

describe('Voice atoms CCCIII — camp teardown & concert end idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
});

describe('negate pins (keep camping / keep playing)', () => {
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
});

describe('null pins (set-up or ongoing, not teardown)', () => {
  test.each(nullPins.map((p) => [p]))('"%s" stays null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
});

describe('established pins', () => {
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k) => {
    expect(key(makeVC(), p)).toBe(k);
  });
});
