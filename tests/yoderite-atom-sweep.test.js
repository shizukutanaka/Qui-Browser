/**
 * Voice atoms CCCVII — broadcast sign-off idioms (EN)
 * + 放送終了/停波/お別れの時間 (JA). The station signing off
 * closes the tab. Going-live or staying-on-air forms stay out.
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
  // --- sign-off / off the air ---
  'signing off the air', 'sign off the mic', 'off the air',
  'off air for good', 'clear the airwaves', 'end of broadcast',
  'broadcast ends', 'broadcast is over', 'station sign-off',
  'final transmission', 'last transmission', 'transmission ends',
  'stop broadcasting', 'cease transmission', 'going dark on air',
  'power down the transmitter', 'kill the signal', 'cut the feed',
  'feed is cut', 'signal lost forever', 'dead air', 'fill the dead air',
  // --- TV sign-off ritual ---
  'test pattern', 'test card', 'color bars', 'national anthem played',
  'fade to black', 'fades to black', 'fade to static', 'static screen',
  'snow on the screen', 'roll the credits', 'credits rolled',
  'end credits', 'that is a wrap on air', 'wrap on the broadcast',
  'thats all folks', 'good night and good luck', 'good night everybody',
  'so long everybody', 'until tomorrow night', 'see you tomorrow night',
  'stay tuned elsewhere', 'program concludes', 'concluding broadcast',
  'the end of the show', 'end of show', 'curtain on the broadcast',
  // --- radio / podcast end ---
  'podcast over', 'episode wrapped', 'end of the episode',
  'last episode ever', 'series finale', 'finale episode',
  'closing theme plays', 'theme music fades', 'outro music',
  'mics down', 'cut the mic', 'kill the mic feed',
];

const closeTabJa = [
  // --- 放送終了 ---
  '放送終了', '放送を終えて', '放送を終了して', '番組終了',
  '番組が終わった', '番組を終えて', '終電放送', 'クロージング',
  'クロージングです', 'お別れの時間です',
  '本日の放送は終了です', '今日の放送は終わり', '放送打ち切り',
  '打ち切りにして', '番組を打ち切って', '最終回', '最終回です',
  '最終放送', '最終番組', 'シリーズ最終回',
  // --- 停波/送信停止 ---
  '停波', '停波時間', '電波を止めて', '電波停止', '送信を止めて',
  '送信終了', '信号を切って', '信号消失', '電波塔を止めて',
  'オフエア', 'オフエアにして', 'エア切れ', '砂嵐', '砂嵐画面',
  'カラーバー', 'テストパターン', '試験電波', '音声消失',
  '映像消失', 'ブラックアウト放送',
  // --- エンディング ---
  'エンディング', 'エンディングです', 'エンドロール',
  'エンドロールが流れて', 'テーマ曲が流れて', 'アウトロ',
  'マイクを下ろして', '収録終了', '収録を終えて',
  '生放送終了', '生中継終了', '配信を終えて', '配信終了',
];

const negate = [
  'stay on the air', 'keep broadcasting', 'still on air', 'stay tuned',
  'まだ放送中', '放送を続けて', '放送中です',
];

// 'mic off' already routes to stop (mic-stop reading); left unpinned.

const nullPins = [
  // going-live / starting broadcast = setup, not ending
  'on the air', 'on air now', 'live now', 'going live',
  'we are live', 'breaking news', 'tune in tonight',
  'channel surfing', 'change the channel', 'next episode',
  '放送中', '生放送', '放送開始', '番組表', 'チャンネル変えて',
  'テレビつけて', 'ラジオを聴く', '続きを見て',
];

const establishedPins = [
  ['エンドロール', 'close-tab'],
  ['off the air', 'close-tab'],
  ['fade to black', 'close-tab'],
  ['roll the credits', 'close-tab'],
  ['お別れです', 'vr-exit'],
  ['マイクを切って', 'stop'],
  ['録画して', 'screen-record'],
];

describe('Voice atoms CCCVII — broadcast sign-off idioms', () => {
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
