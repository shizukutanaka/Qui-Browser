/**
 * Voice atoms CCCIV — shift-end / clock-out idioms (EN) + 退勤/仕事納め (JA).
 * Saying "work is over" closes the tab. Set-up or ongoing forms stay null.
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
  // --- clock-out / punch-out ---
  'clock out', 'clock me out', 'clocking out', 'punch out', 'punch me out',
  'punch the clock out', 'time card punched', 'timesheet done',
  'sign off for the day', 'log off shift', 'shift is over',
  'shift ended', 'end of shift', 'end of my shift', 'my shift is done',
  'shift wrapped', 'last shift done', 'double shift over',
  'quitting time', 'whistle blew', 'five oclock shadow', 'nine to five done',
  'off the clock', 'im off the clock', 'off duty now', 'done for the day',
  'wrap for the day', 'wrap it up for today',
  'days work done', 'honest days work', 'put in my hours', 'hours logged',
  'eod done', 'end of day wrap', 'close of business', 'closing time work',
  // --- tools down / job done ---
  'down tools', 'tools down', 'hang up the apron', 'hang up the hat',
  'hang up the hard hat', 'apron off', 'gloves off', 'helmet off',
  'power down the tools', 'bench cleared', 'lock the toolbox',
  'sweep the floor and go', 'mop it up and leave', 'counters wiped',
  'lights off in the shop', 'shop lights out', 'kill the lights and go',
  'lock up the shop', 'shutter the counter', 'register counted',
  'drawer counted', 'tills counted', 'safe locked', 'keys turned',
  // --- commute / leaving ---
  'out the door', 'im out the door', 'head home', 'heading home',
  'off to home', 'beeline home', 'commute home', 'train home',
  'car keys out', 'drive home now', 'walked out the gate',
  'badge out', 'badge me out', 'swipe out', 'tap out the badge',
  'elevator down to lobby', 'stairs to the street',
];

const closeTabJa = [
  // --- 退勤/終業 ---
  '退勤', '退勤します', '退勤打刻', '打刻して帰る', 'タイムカード切って',
  'タイムカードを切る', '定時退社', '定時で帰る', '定時上がり',
  '終業', '終業のチャイム', 'チャイムが鳴った', '今日の仕事終わり',
  '仕事終わり', '業務終了', '本日の業務終了', '勤務終了', '残業終わり',
  'ノー残業デー', '早退させて', 'しごおわ', '仕事納め', '納会',
  '年末仕事納め', '御用納め', '大納会', '納会終わり',
  // --- 作業終了/片付け ---
  '作業終了', '作業を畳んで', '工具をしまって', '道具を片付けて',
  '機械を止めて', 'エプロンを外して', '手袋を外して', 'ヘルメットを脱いで',
  '現場を締めて', '工場を閉めて', '照明を落として', '電気を消して',
  '施錠して', '戸締まりして', 'レジを締めて', '売上を締めて',
  '金庫を閉めて', '清掃して帰る', '掃除して終わり',
  // --- 帰宅 ---
  '帰宅します', '家に帰る', '帰路に着く', '終電で帰る',
  '満員電車で帰る', 'デスクを片付けて', '椅子をしまって',
  'パソコンを閉じて', 'pcを畳んで', 'パソコンを畳んで', 'バッグを持って帰る',
  'お疲れ様でした',
];

const negate = [
  'keep working', 'stay on the clock',
  'still on shift', 'まだ仕事中', 'まだ勤務中', '仕事を続けて',
];

const nullPins = [
  // starting / ongoing work — not ending
  'clock in', 'punch in', 'start the shift', 'first shift',
  'morning shift', 'on the clock', 'still at work', 'working late',
  'overtime tonight', 'unlock the register', 'commute in', 'badge in',
  'swipe in',
  '出勤', '出勤します', '出社', '始業', '始業のチャイム',
  '朝礼', '仕事始め', '年始仕事始め', '初出', 'まだ在席',
];

const establishedPins = [
  ['call it a day', 'stop-everything'],
  ['call it a day already', 'stop-everything'],
  ['帰ります', 'vr-exit'],
  ['signing off', 'vr-exit'],
  ['お先に失礼します', 'vr-exit'],
  ['お先に', 'vr-exit'],
  ['お疲れ様です', 'ack'],
  ['keep at it', 'resume-reading'],
];

describe('Voice atoms CCCIV — shift-end & work-done idioms', () => {
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
