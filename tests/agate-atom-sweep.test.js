// pass CCCXXXII agate atom sweep — gym / workout / training done idioms.
// endings announce completion -> close-tab; continuations -> negate;
// in-progress / scheduled -> null; established pins honoured.
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => null, closeTab: () => {}, tabs: () => [] });
  return vc;
}
function key(vc, p) { const r = vc._matchCommand(p); return r && r.key; }

const closeTab = [
  // workout / sets done
  'workout done', 'workout complete', 'gym done', 'gym session over',
  'gym time over', 'last set', 'sets done', 'all sets done', 'reps done',
  'final rep', 'last rep', 'sets and reps done', 'split done',
  'program done', 'routine done', 'cycle done', 'session logged',
  'workout logged', 'finished the workout', 'crushed the workout',
  'killed the workout', 'smashed the workout', 'beast mode off',
  'leg day done', 'arm day done', 'maxed out', 'pumped',
  // cardio / run / race
  'cardio done', 'treadmill stopped', 'off the treadmill', 'run finished',
  'jog done', 'run done', 'race finished', 'marathon done',
  'marathon finished', 'crossed the finish line', 'sprint finished',
  'miles logged', 'logged the miles', 'trail done', 'summit reached',
  'mountain climbed', 'descent done', 'topped out the route',
  'route ticked', 'sent the route', 'project sent',
  // gym wrap-up
  'cool down done', 'warm down done', 'warmed down', 'stretched out',
  'stretch session', 'foam rolled', 'ice bath done', 'sauna done',
  'steam room done', 'showered', 'earned the shower', 'sweat session',
  'dripping sweat', 'gym bag packed', 'locker locked', 'left the gym',
  'gym closed', 'water bottle empty', 'towel in the bag',
  'heart rate down', 'weights racked', 'weights put away',
  'barbell racked', 'dumbbells put back', 'mat rolled up',
  // pool / class / practice
  'pool done', 'pool closed', 'swim done', 'laps done', 'lane cleared',
  'swim meet done', 'yoga done', 'class over', 'spin class done',
  'practice over', 'practice ended', 'drills done', 'drills complete',
  'coach dismissed', 'huddle broke', 'team dinner', 'post game',
  'postgame', 'film session done', 'tape reviewed', 'meet over',
  'tournament done', 'match won', 'lost the match', 'played out',
  'full time', 'final score',
  // dojo / fight
  'dojo closed', 'dojo empty', 'mats cleaned', 'gear bagged',
  'gi folded', 'belt tied off', 'bowed out', 'bowed to the mat',
  'tapped out', 'submission done', 'sparring done', 'rounds done',
  'sensei dismissed', 'weigh in done', 'fight night over',
  'title bout done', 'ring left', 'hand wraps off', 'cage empty',
  'black belt earned', 'belt test done', 'belt promotion',
  'championship won', 'belt defended', 'trophy raised', 'podium done',
  'medal ceremony',
  // records / tracking
  'watch stopped', 'stopped the watch', 'strava uploaded',
  'fitness app logged', 'synced the workout', 'calories burned',
  'goal hit', 'goal smashed', 'steps done', 'closed the rings',
  'rings closed', 'streak kept', 'streak alive', 'new pb', 'pb',
  'pr today', 'new pr', 'pr set', 'personal record', 'record broken',
  'record set', 'lifetime best', 'season best',
  // camp / season / withdrawal
  'training camp over', 'camp done', 'season done', 'physio done',
  'active recovery done', 'rest day', 'off day', 'recovery day',
  'dnf', 'did not finish', 'finished the race', 'withdrew',
  'retired hurt', 'pulled out of the race', 'sat out', 'scratched',
];

const closeTabJa = [
  // トレーニング/セット終了
  '筋トレ終了', 'トレーニング終了', 'ワークアウト終了', 'セット完了',
  'ラストセット', 'クールダウン', 'ストレッチ終了', '有酸素終了',
  '今日のメニュー終了', '限界までやって', 'オールアウト',
  'パーソナルトレーニング終了', 'ボディメイク終了', '運動を終えて',
  '体を鍛えて', '効いた', '汗だく', '運動不足解消',
  // ジム退出/片付け
  'ジムを出て', 'ロッカーを閉めて', 'ロッカールームを出て',
  'スタジオを出て', 'シャワー浴びて', '汗を流して', '汗を拭いて',
  '着替えて', '着替え終了', 'ウェアを脱いで', 'シューズを脱いで',
  'ウェイトを片付けて', 'バーベルを戻して', 'ダンベルを戻して',
  'マットを畳んで', 'タオルをしまって', 'トレッドミルを止めて',
  'プロテインを飲んで', '疲労回復', 'リカバリー終了',
  'サウナを出て', '水風呂に入って', '整いました',
  // ラン/記録
  'ランニング終了', '走り終わって', 'マラソン完走', 'ゴールして',
  'フィニッシュ', '記録更新', '自己ベスト', 'ログを記録して',
  '測定終了', 'リングを閉じて', '歩数目標達成', 'ダイエット成功',
  '目標体重達成', '体脂肪率目標達成',
  // プール/レッスン/部活/道場
  'プール終了', '泳ぎ終わって', 'ヨガ終了', 'レッスン終了',
  '練習終了', '部活を終えて', '試合が終わって', '道場を出て',
  '組手終了', '稽古終了', '帯を締めて', '帯が締まって',
  // 大会/合宿
  '大会終了', '記録会終了', '合宿終了', 'ジムをやめて',
  '筋トレをやめて', '帰宅してシャワー',
];

const negate = [
  'keep working out', 'one more set', 'stay at the gym',
  'still working out', 'keep running', 'まだ筋トレ中',
  'まだトレーニング中', 'トレーニングを続けて', 'もう一套',
  'あと一套', 'ワンモアセット', 'ジムに残って', '追い込み中',
];

const nullPins = [
  'working out', 'at the gym', 'mid workout', 'warming up',
  'first set', 'still at the gym', 'training for the marathon',
  'in season', 'bulking', 'cutting', 'gym streak going',
  '筋トレ中', 'トレーニング中', 'ジムにいる', 'ウォームアップ中',
  'ジム活', '合宿中', 'シーズン中', '増量中', '減量中',
  'トレーニング予定', 'ジム予定',
];

const establishedPins = [
  ['training done', 'close-tab'],
  ['done for today', 'close-tab'],
  ['done for the day', 'close-tab'],
  ['bench cleared', 'close-tab'],
  ['hit the showers', 'close-tab'],
  ['hike done', 'close-tab'],
  ['rolled out', 'close-tab'],
  ['locker cleaned out', 'close-tab'],
  ['season over', 'close-tab'],
  ['gloves off', 'close-tab'],
  ['目標達成', 'close-tab'],
  ['追い込んで', 'close-tab'],
  ['シーズン終了', 'close-tab'],
  ['表彰式終了', 'close-tab'],
  ['sore tomorrow', 'date'],
  ['workout tomorrow', 'date'],
  ['gym tomorrow', 'date'],
  ['pitch done', 'speech-pitch-status'],
  ['open water swim done', 'go-to'],
  ['ジムに行ってきて', 'go-to'],
  ['途中でやめて', 'pause-reading'],
];

describe('Voice atoms CCCXXXII — gym/workout done idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab (JA)', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
  test.each(nullPins.map((p) => [p]))('"%s" -> null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k2) => {
    expect(key(makeVC(), p)).toBe(k2);
  });
});
