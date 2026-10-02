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
  // meeting end
  'meeting over', 'the meeting is over', 'meeting ended', 'meeting done',
  'meeting wrapped', 'meeting adjourned',
  // call end
  'call over', 'the call is over', 'call ended', 'call done',
  'call disconnected', 'off the call', 'hung up', 'hung up the phone',
  'line went dead', 'wrapped the call', 'wrapped up the call',
  'call wrapped up', 'ended the zoom', 'left the zoom', 'zoom ended',
  // leaving / follow-up
  'left the meeting', 'out of the meeting', 'back from the meeting',
  'schedule next meeting', 'recap sent', 'notes shared', 'slides shared',
  'deck sent', 'recording saved', 'transcript saved',
  'minutes taken', 'action items assigned', 'follow ups assigned',
  'thanks everyone', 'thanks for coming', 'everyone left',
  'room emptied', 'conference room cleared',
  // rituals / formats
  'standup done', 'stand up done', 'daily done', 'scrum done',
  'retro done', 'retrospective done', 'review done',
  'all hands done', 'allhands done', 'town hall done', 'town hall over',
  'one on one done', '1:1 done', 'sync done', 'huddle done',
  'check in done', 'check-in done', 'debrief done', 'debriefed',
  'briefing done', 'briefed', 'workshop done', 'workshop over',
  'brainstorm done', 'brainstorm over', 'session done',
  'agenda done', 'agenda covered',
  // ran over / wrap
  'meeting ran over', 'meeting ran long', 'out of time',
  'wrapped on time', 'hard stop', 'meeting called early',
  'cut the meeting short', 'ended early', 'talked out', 'all talked out',
  'nothing left to discuss', 'topic covered', 'tabled it',
  'parking lotted it', 'offline for that', 'next steps set',
  'host ended the meeting', 'kicked from the meeting',
  // formal bodies
  'board meeting done', 'shareholder meeting done', 'committee met',
  'committee done', 'panel over', 'roundtable done',
  'webinar done', 'webinar over', 'question time over',
  // call types
  'client call done', 'sales call done', 'vendor call done',
  'interview call done', 'catch up done', 'coffee chat done',
  'lunch meeting done', 'dinner meeting done', 'networking done',
  'mingle done', 'icebreaker done',
];
const closeTabJa = [
  // 会議
  '会議終了', '会議が終わって', '会議を出て', '会議室を出て',
  'ミーティング終了', 'ミーティングが終わって', '定例終了',
  '定例ミーティング終了', '朝会終了', '朝礼終了', '夕会終了',
  '週次会議終了', '月例会議終了', '臨時会終了', '緊急会議終了',
  '全体会議終了', '全体ミーティング終了', 'スタンドアップ終了',
  'デイリー終了', 'スクラム終了', '朝の連絡会終了', '連絡会終了',
  '報告会終了', '進捗会議終了', '振り返り終了',
  'レトロスペクティブ終了', 'ふりかえり終了', 'レビュー会終了',
  '成果発表会終了', '発表会終了', 'プレゼン終了', 'プレゼンが終わって',
  // 打ち合わせ/商談
  '打ち合わせ終了', '打ち合わせを出て', '打合せ終了', '商談終了',
  '商談が終わって', '面談を出て', 'ヒアリング終了', '相談会終了',
  '説明会終了', '説明会を出て', '講演終了', '講演会を出て',
  'セミナー終了', 'セミナーを出て', '研修を出て', 'ワークショップ終了',
  '座談会終了', '懇談終了', 'パネルディスカッション終了',
  '討論会終了', 'シンポジウム終了', 'フォーラム終了',
  // 組織の会
  '総会終了', '株主総会終了', '理事会終了', '委員会終了',
  '部門会議終了', 'チーム会議終了', '役員会議終了', '経営会議終了',
  '取締役会終了', '班会終了', '班会を出て', '保護者会終了',
  '三者面談終了', 'pta会議終了', '町内会終了', '自治会終了',
  '寄り合い終了', '会合終了', '会合を出て',
  // オンライン/電話
  '電話会議終了', 'ウェブ会議終了', 'オンライン会議終了',
  'リモート会議終了', 'テレビ会議終了', 'zoomを閉じて',
  'zoomを出て', 'zoomを切って', '通話を切って', '電話を切って',
  '退出しました', '退室しました', '会議から退出して',
  // 共有/記録の終了
  '画面共有を止めて', '画面共有を終了して', '資料を閉じて',
  '議事録を取って', 'アクションアイテムを整理して',
  '宿題を整理して', '次回予定を決めて', 'アジェンダを消化して',
  '議題を終えて', '議題が尽きて', '質疑応答終了', '質問タイム終了',
  // 挨拶/退出
  '早めに切り上げて', '会議を切り上げて', '一時解散',
  '本会議を終えて', '自由討議終了', '雑談が終わって',
  '世間話が済んで', '名刺交換が終わって', '挨拶が済んで',
  '自己紹介が終わって', '出席を取って', '欠席連絡を出して',
  'お先に失礼して', '先に失礼して', '失礼して退出して',
  '議長が閉会して', '閉会を宣言して', '散会', '解散になって',
];
const negate = [
  'let us continue the meeting', 'keep the meeting going',
  'still in the meeting', 'stay on the call', 'one more agenda item',
  '会議を続けて', '話し合いを続けて', '残って打ち合わせして',
];
const nullPins = [
  // in-progress / scheduled / bare nouns
  'at the meeting', 'in a meeting', 'on the agenda', 'waiting room',
  'dialing in', 'meeting invite', 'meeting request',
  'scheduled for monday',
  '会議中', '会議に出て', '通話中', '入室待ち', '会議室にいる',
  '開催前', '来週打ち合わせ',
];
const establishedPins = [
  // close-tab pins
  ['demo done', 'close-tab'], ['session wrapped', 'close-tab'],
  ['take it offline', 'close-tab'], ['panel done', 'close-tab'],
  ['q and a done', 'close-tab'], ['面談終了', 'close-tab'],
  ['デモ終了', 'close-tab'], ['研修終了', 'close-tab'],
  ['延長戦終了', 'close-tab'], ['時間切れで終わって', 'close-tab'],
  ['お疲れ様でした', 'close-tab'], ['解散しました', 'close-tab'],
  // other atoms win
  ['livestream ended', 'screen-record'], ['pitch meeting done', 'speech-pitch-status'],
  ['call me back', 'device-apps'], ['meeting tomorrow', 'date'],
  ['明日会議', 'defer'], ['電話をかけて', 'device-apps'],
];

describe('pass CCCXXXVI: meeting/call/conference end idioms (sakura)', () => {
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
