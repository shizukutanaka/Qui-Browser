/**
 * Voice atoms CCCVIII — stadium & season-end idioms (EN)
 * + 試合終了/観客退場/閉場 (JA). The final whistle / stadium
 * emptying closes the tab. Game-start and keep-watching stay out.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  const tabs = [{ id: 1, url: 'https://a.example', title: 'A' }];
  vc.connectBrowser({
    getActiveTab: () => tabs[0],
    closeTab: () => {},
    tabs: () => tabs,
  });
  return vc;
}

function key(vc, phrase) {
  const r = vc._matchCommand(phrase);
  return r && r.key;
}

const closeTab = [
  // --- final whistle / game over ---
  'final whistle', 'whistle blew', 'buzzer sounded', 'final buzzer',
  'game over for real', 'ball game over', 'thats the ballgame',
  'called game', 'mercy rule invoked', 'game called early',
  'lights out at the stadium', 'stadium lights off',
  'stadium emptied', 'stands emptied', 'crowd went home',
  'fans gone home', 'turnstiles closed', 'gates are closed',
  'scoreboard off', 'scoreboard went dark', 'jumbotron off',
  'vendors packed up', 'concessions closed', 'cleanup crew out',
  'locker room cleared', 'showers running', 'equipment trucked',
  'mop the dugout', 'tarp on the field', 'rain delay permanent',
  // --- season end ---
  'season over', 'the season is over', 'season wrapped',
  'season in the books', 'offseason now', 'went into the offseason',
  'playoffs done', 'eliminated from playoffs', 'bracket busted',
  'the fat lady sang', 'fat lady has sung', 'mathematically eliminated',
  'relegated', 'sent down for good', 'demoted to the bench',
  'waved goodbye to the season', 'awards handed out',
  'trophy hoisted', 'champagne popped', 'gatorade dumped',
  'dogpile done', 'on the podium', 'ceremony wrapped',
  'ring ceremony done', 'banner raised', 'victory parade over',
  'parade ended', 'tickertape cleaned', 'offseason workouts begun',
  // --- referee wrap ---
  'ref blew the whistle', 'refs went home', 'umpire called it',
  'scorecard signed', 'handshakes done', 'good game good game',
  'cleats hung up', 'hang up the cleats', 'hang up the jersey',
  'jersey retired', 'number retired', 'cleats in the locker',
];

const closeTabJa = [
  // --- 試合終了 ---
  '試合終了', '試合が終わった', '試合終わり', '終了のホイッスル',
  'ブザーが鳴った', 'ゲームセット', 'プレーボール終了',
  'コールドゲーム', 'コールド負け', 'サヨナラゲーム',
  'サヨナラ勝ち', '延長戦終了', 'タイブレーク終了',
  '引き分け終了', 'ノーゲーム', '試合成立',
  // --- 観客退場/閉場 ---
  '観客が帰って', '観客退場', 'スタンドが空いて', 'ガラ空き',
  'スタジアム消灯', '球場消灯', '照明を落として', '場内消灯',
  'スコアボード消して', '売店が閉まって', 'ゲートが閉まって',
  '退場完了', '清掃員が入って', '閉場', '閉場時間',
  'グラウンドを畳んで', 'ロッカールームを締めて',
  // --- シーズン終了 ---
  'シーズン終了', 'シーズンが終わった', 'オフシーズン',
  'プレーオフ終了', '敗退確定', '優勝決定', '胴上げ',
  '胴上げが終わって', '表彰式終了', '優勝パレード終了',
  'リーグ戦終了', '全日程終了', 'レギュラーシーズン終了',
  '数値的敗退', '降格確定', '最下位確定',
  // --- 記録/引退 ---
  'スコアカードを締めて', '記録員が帰って', 'ユニフォームを脱いで',
  'スパイクを脱いで', '靴を脱いで', '背番号を下ろして',
  '永久欠番', '引退試合終了', '現役最後の試合',
];

const negate = [
  'keep watching the game', 'stay for extra innings',
  'the game continues', 'still in the game', '試合を見続けて',
  'まだ試合中', '応援を続けて',
];

const nullPins = [
  // game start / in-progress = setup, not ending
  'kickoff', 'first pitch', 'play ball', 'game started',
  'tailgate party', 'pregame show', 'warmup time',
  '試合開始', 'プレーボール', 'キックオフ', '先発',
  'チケットを買って', '観戦中', '生観戦', '応援席',
];

const establishedPins = [
  ['試合終了のホイッスル', 'close-tab'],
];

describe('Voice atoms CCCVIII — stadium & season-end idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
  test.each(nullPins.map((p) => [p]))('"%s" -> null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k) => {
    expect(key(makeVC(), p)).toBe(k);
  });
});
