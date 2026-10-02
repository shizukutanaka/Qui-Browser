/**
 * Voice atoms CCCXV — theater/cinema closing-night & house-lights
 * idioms (EN) + 終演/千穐楽/上映終了 (JA). Curtain down, lights up,
 * house empty: close the tab. Showtime/matinée-start stay out.
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
  // --- curtain & bows ---
  'curtain call done', 'final curtain call', 'bows taken',
  'cast took their bows', 'standing ovation ended',
  'ovation died down', 'applause faded', 'applause died',
  'curtain came down', 'curtain fell', 'curtain dropped',
  'drapes closed', 'grand drape down', 'act drop down',
  'closing night', 'closing performance', 'last performance',
  'final performance', 'closing show', 'last show of the run',
  'run is over', 'show closed', 'show closed tonight',
  'tour ended', 'farewell performance', 'swan song performed',
  // --- cinema / screening ---
  'house lights up', 'house lights came up', 'lights came up',
  'the lights came up', 'theater lights up', 'cinema lights up',
  'projector stopped', 'projector shut off', 'reel ended',
  'last reel ended', 'film ended', 'screening ended',
  'screening is over', 'movie ended', 'feature ended',
  'double feature done', 'matinee ended', 'late show ended',
  'midnight showing ended', 'premiere ended', 'festival screening done',
  'credits done', 'post credits scene done', 'stinger done',
  'screen went dark', 'screen went black', 'marquee went dark',
  'marquee lights off', 'box office closed', 'concessions closed',
  // --- house emptying ---
  'theater emptied', 'cinema emptied', 'house emptied',
  'audience filed out', 'audience went home', 'patrons left',
  'ushers cleaned up', 'ushers cleared the rows',
  'balcony emptied', 'orchestra seats empty', 'gallery emptied',
  'aisles cleared', 'rows emptied', 'lobby emptied',
  'stage door closed', 'green room emptied', 'dressing rooms dark',
  'set struck', 'stage struck', 'props stored', 'costumes hung',
  'ghost light on', 'ghost light lit',
];

const closeTabJa = [
  // --- 終演/幕 ---
  '終演', '終演しました', '幕が下りて', '幕が下りた',
  '幕を下ろして', '終幕', '大団円', 'カーテンコール終了',
  'カーテンコールが終わって', 'スタンディングオベーション終了',
  '拍手が鳴り止んで', '拍手が静まって', '万雷の拍手',
  '千秋楽', '千穐楽', '楽日', '大楽', '大千穐楽',
  '中日終了', '前楽', '最終公演', '最終公演終了', '公演終了',
  '公演が終わって', '閉幕', '閉幕しました', '楽屋に引っ込んで',
  // --- 上映/映画館 ---
  '上映終了', '上映が終わって', '映画終了', '映画が終わって',
  '館内が明るくなって', '場内が明るくなって', '照明がついて',
  '映写終了', '映写機を止めて', 'スクリーンが暗くなって',
  'エンドロール終了', 'エンドクレジット終了', '最終上映',
  'レイトショー終了', '初日終了', 'プレミア上映終了',
  '映画祭終了', '特別上映終了', '二本分立て終了',
  // --- 観客退場/楽屋 ---
  '観客が帰って', '観客が退場して', '客席が空いて',
  '客電が消えて', '客電が落ちて', '劇場を出て', '映画館を出て',
  '出口に向かって', 'ロビーが空いて', '座席が空いて',
  '案内係が片付けて', '楽屋口が閉まって', '楽屋が明けて',
  '舞台を畳んで', '大道具を片付けて', '小道具をしまって',
  '衣装をしまって', '舞台照明を落として', 'ゴーストライトを点けて',
];

const negate = [
  'stay for the encore', 'stay for the credits', 'keep watching the show',
  'stay in your seats', 'まだ上映中', '公演を続けて', '観続けて',
];

const nullPins = [
  // showtime / ongoing
  'curtain up', 'showtime', 'matinee starts', 'opening night',
  'premiere begins', 'intermission', 'act one', 'second act',
  '開演', '開演します', '初日', '上映中', '観劇中',
  '幕間', '休憩時間', '前半終了', 'チケットを買って',
];

const establishedPins = [
  ['final curtain', 'close-tab'],
  ['credits rolled', 'close-tab'],
];

describe('Voice atoms CCCXV — theater/cinema closing-night & house-lights', () => {
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
