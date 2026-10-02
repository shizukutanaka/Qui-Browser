/**
 * Voice atoms CCCXXI — game & match end idioms (EN)
 * + ゲームオーバー/投了/全クリ (JA). Game over = close the tab.
 * In-progress play and session-start phrases stay out.
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
  // --- game over ---
  'game over', 'its game over', 'thats game over',
  'game over man', 'its a game over', 'games over',
  'the game is over', 'match over', 'match is over',
  'round over', 'level complete', 'stage clear',
  // --- resign / surrender ---
  'i resign', 'resigning the game', 'concede the game',
  'i concede', 'throw in the cards', 'folded the hand',
  'surrender the match', 'forfeit the game', 'gave up the game',
  'rage quit', 'ragequitting', 'alt f4ed', 'quit out',
  // --- board/table end ---
  'checkmate', 'thats checkmate', 'check mated',
  'king fell', 'king is down', 'mated', 'stalemate',
  'resigned the board', 'swept the pieces', 'board cleared',
  'packed the board', 'put the pieces away', 'cards folded up',
  'last hand played', 'table closed', 'cash out done',
  // --- completion / credits ---
  'beat the game', 'beat the final boss', 'final boss down',
  'boss is down', 'boss defeated', 'last boss beaten',
  'cleared the game', 'finished the game', 'game completed',
  'game cleared', 'hundred percented', 'platinumed it',
  'all achievements unlocked', 'trophy collected',
  'beat the campaign', 'campaign finished', 'story finished',
  'end credits', 'end credits rolled', 'watched the credits',
  'epilogue watched', 'new game plus ready', 'post credits done',
  // --- powering down ---
  'saved and quit', 'saved and exited', 'quit to menu',
  'quit to desktop', 'exited the game', 'logged out of the game',
  'powered off the console', 'console powered off', 'console off',
  'turned off the console', 'shut down the console',
  'closed the game', 'uninstalled the game', 'deleted the save',
  'controller down', 'put the controller down', 'controller off',
  'headset off', 'arcade closed', 'tokens spent',
];

const closeTabJa = [
  // --- ゲームオーバー/終了 ---
  'ゲームオーバー', 'ゲーム終了', '試合終了しました',
  'ラウンド終了', 'ステージクリア', 'レベルクリア',
  // --- 投了/降伏 ---
  '投了', '投了します', '参りました', 'まいりました',
  '降参', '降参します', '負けを認めて', '負けを宣言して',
  '投了ボタン', 'リタイア', '途中棄権',
  // --- 将棋/ボード ---
  '詰み', '詰んだ', 'チェックメイト', '王手で終わって',
  '王が倒れて', '玉が取られて', 'ステイルメイト',
  '駒をしまって', '盤を片付けて', '碁盤を畳んで',
  '将棋盤を片付けて', 'カードをしまって', '最終局終了',
  // --- クリア/コンプリート ---
  'クリア', 'クリアしました', 'ゲームクリア', '全クリ',
  '完全クリア', 'コンプリート', '百パーセント達成',
  'トロフィーコンプ', '実績全解除', 'ラスボスを倒して',
  '最終ボス撃破', 'ボスを倒しきって', 'エンディング到達',
  'エンディングを見て', 'エンディングを見終わって',
  'エンドロール終了', 'スタッフロール', 'エピローグ終了',
  'ストーリー終了', 'キャンペーンクリア', '周回開始',
  // --- 終了/電源 ---
  'セーブして終了', 'セーブしてやめて', 'ゲームをやめて',
  'ゲームを閉じて', 'メニューに戻って', 'タイトルに戻って',
  'デスクトップに戻って', 'ゲームから出て',
  'コンソールを切って',
  'ゲーム機を切って', 'コントローラーを置いて',
  'コントローラーの電源を切って', 'ヘッドセットを外して',
  'アンインストールして', 'セーブデータを消して',
  'ゲームセンター閉店', 'メダル払い戻し',
];

const negate = [
  'keep playing', 'stay in the game', 'one more round',
  'keep grinding', 'dont quit now', 'まだゲーム中',
  'ゲームを続けて', 'もう一局して', 'プレイを続けて',
];

const nullPins = [
  // in-progress / session start
  'playing the game', 'in the middle of a match',
  'new game started', 'game starting', 'loading screen',
  'first level', 'tutorial done', 'respawned',
  'multiplayer lobby', 'queue popped', 'match found',
  'ゲーム中', 'プレイ中', '対局中', 'マッチング中',
  'ゲーム開始', 'ニューゲーム', 'チュートリアル中',
  'ロビーにいる', 'リスポーンした', '周回中',
];

const establishedPins = [
  ['gg', 'ack'],
  ['credits rolled', 'close-tab'],
  ['ゲームセット', 'close-tab'],
  ['ギブアップ', 'trouble'],
  ['ログアウトして', 'account'],
  ['電源を切って', 'sleep-mode'],
  ['電源を落として', 'sleep-mode'],
];

describe('Voice atoms CCCXXI — game & match end idioms', () => {
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
