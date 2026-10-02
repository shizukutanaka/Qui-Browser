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
  // party wind-down
  'party over', 'the party is over', 'party ended', 'party done',
  'last guest left', 'guests went home', 'everybody left',
  'guests cleared out', 'crowd thinned out', 'host waved goodbye',
  'host said goodnight', 'wrapped up the party', 'wound down the party',
  'shut the party down', 'kicked everyone out', 'lingered till the end',
  'closed the place down',
  // music / floor / bar
  'music off', 'music stopped', 'dj done', 'dj packed up',
  'bar closed', 'last call done', 'dance floor cleared',
  'last dance played',
  // teardown / venue
  'balloons popped', 'tables cleared', 'chairs stacked',
  'venue cleaned', 'venue emptied', 'venue closed', 'hall emptied',
  'tent struck down', 'folding tables stacked', 'bounce house deflated',
  'piñata smashed', 'pinata smashed', 'candles blown',
  'decorations packed', 'streamers packed', 'photo booth closed',
  'photo booth packed', 'rentals returned', 'coat check closed',
  'goodie bags gone', 'favors handed out', 'guest list done',
  'rsvp closed', 'headcount done', 'hosted the party', 'party hosted',
  // cake / toasts / gifts
  'cake served', 'cake cut', 'toasts done', 'toast made',
  'speeches done', 'speeches over', 'birthday song sung',
  'happy birthday sung', 'presents opened', 'gifts opened',
  'thank you notes written',
  // wedding
  'reception ended', 'reception over', 'reception done',
  'wedding over', 'wedding ended', 'wedding done', 'ceremony done',
  'vows said', 'kissed the bride', 'bouquet tossed', 'garter tossed',
  'send off done', 'sparkler exit done', 'sparklers done',
  'rice thrown', 'birdseed thrown', 'bubbles blown',
  'getaway car left', 'limo left', 'honeymoon bound',
  'first dance done', 'father daughter dance done',
  'mother son dance done', 'anniversary party done',
  'bridal shower done', 'baby shower done', 'gender reveal done',
  'reveal party done', 'engagement party done', 'bachelor party done',
  'bachelorette done', 'rehearsal dinner done', 'rehearsal done',
  'welcome party done', 'after party done', 'afterparty over',
  'after hours done', 'shower over',
  // venue / staff wrap
  'event over', 'event ended', 'event done', 'event wrapped',
  'wrap the event', 'teardown done', 'breakdown done', 'strike done',
  'backstage cleared', 'greenroom emptied', 'meet and greet done',
  'autographs done', 'signing done', 'book signing done',
  'photo ops done', 'red carpet rolled', 'velvet ropes down',
  'stanchions down', 'security dismissed', 'valet closed',
  'parking emptied', 'lot cleared', 'crowd dispersed',
  'stragglers left', 'turned the lights off', 'locked the venue',
  'doors locked', 'venue locked up',
];
const closeTabJa = [
  // 宴/会
  'パーティー終了', 'パーティーが終わって', '宴のあと', '宴が終わって',
  '宴会終了', '宴会を出て', '飲み会終了', '飲み会を出て',
  '二次会終了', '二次会を出て', '三次会終了', '三次会を出て',
  '四次会', 'お開きになって', '一本締め', '三本締め', '締めの挨拶',
  '乾杯済み', '乾杯が終わって', '挨拶が終わって', 'スピーチ終了',
  '祝辞終了', '余興終了', '余興が終わって', '出し物終了',
  'ビンゴ大会終了', '景品を配って', 'プレゼントを配って',
  'お土産を渡して', '記念撮影終了', '集合写真を撮って',
  // 撤収
  '撤収が終わって', '会場を出て', '会場が空っぽ', '客が帰って',
  '全員帰って', 'みんな帰って', '帰り支度', 'お見送りをして',
  '見送りが終わって', '最後の客が帰って', '受付を締めて',
  '受付終了', 'クロークを閉めて', '忘れ物を回収して',
  '残置物チェック', '椅子を積んで', 'テーブルを畳んで',
  '装飾を外して', '飾り付けを片付けて', '風船を割って',
  '紙吹雪を掃いて', '楽屋を畳んで', 'バックヤードを閉めて',
  'bgmを切って', '照明を元に戻して', 'ダンスフロアを閉めて',
  // 婚礼
  '披露宴終了', '披露宴を出て', '結婚式終了', '結婚式を出て',
  '挙式終了', '誓約済み', '指輪交換終了', 'ケーキカット',
  'ケーキ入刀', 'ファーストバイト', 'ブーケトス', 'ブーケを投げて',
  '花嫁の手紙', '新郎新婦退場', 'お色直し終了', '再入場終了',
  '送賓終了', 'ゲストを見送って', 'ハネムーン出発',
  '新婚旅行へ発って', '二次会幹事終了', '幹事を終えて',
  // 会の種類
  '忘年会終了', '忘年会を出て', '新年会終了', '新年会を出て',
  '歓送迎会終了', '送別会を出て', '歓迎会を出て', '同窓会終了',
  '同窓会を出て', '懇親会終了', '懇親会を出て', '打ち上げを出て',
  'コンパ終了', '合コン終了', 'クリスマス会終了', '誕生日会終了',
  '誕生日パーティー終了', 'サプライズ成功', 'サプライズ終了',
  '還暦祝い終了', '長寿祝い終了', '入学祝い終了', '卒業祝い終了',
  '就職祝い終了', '出産祝い終了', '内祝いを渡して',
  // 酒/備品
  'シャンパンを抜いて', '泡を抜いて', 'ワインを飲み干して',
  'グラスを下げて', 'ケータリング撤収', '仕出しを返して',
  'レンタル品を返して', '機材を返して', 'パネルをしまって',
  '抽選会終了', 'じゃんけん大会終了', 'ゲーム大会終了',
  'カラオケ大会終了', 'コスプレを脱いで', '仮装を解いて',
];
const negate = [
  'keep the party going', 'party on', 'keep celebrating',
  'still partying', 'one more drink', 'stay at the party',
  '宴を続けて', 'もう一杯いって', 'まだ飲んで',
  'パーティーを続けて', 'まだまだ飲んで', '飲み直して',
];
const nullPins = [
  // in-progress / scheduled / bare nouns
  'at the party', 'party time', 'at the reception', 'at the venue',
  'party tonight', 'hosting tonight', 'on the guest list',
  'photo booth', 'coat check', 'まだパーティー中',
  'パーティー中', '宴会中', '披露宴中', '二次会中', '会場にいる',
  '受付中', '開宴前', '来週パーティー',
];
const establishedPins = [
  // close-tab pins
  ['everyone went home', 'close-tab'], ['band packed up', 'close-tab'],
  ['dance floor emptied', 'close-tab'], ['lights came up', 'close-tab'],
  ['confetti swept', 'close-tab'], ['decorations down', 'close-tab'],
  ['streamers down', 'close-tab'], ['tent struck', 'close-tab'],
  ['candles blown out', 'close-tab'], ['last dance', 'close-tab'],
  ['load out done', 'close-tab'], ['お開きにして', 'close-tab'],
  ['お開きで', 'close-tab'], ['撤収完了', 'close-tab'],
  ['会場を畳んで', 'close-tab'], ['会場撤収', 'close-tab'],
  ['机を片付けて', 'close-tab'], ['食器を下げて', 'close-tab'],
  ['看板を下ろして', 'close-tab'],
  // other atoms win
  ['open bar closed', 'go-to'], ['open bar', 'go-to'],
  ['house lights on', 'brightness'],
  ['音楽を止めて', 'video-stop'], ['明日披露宴', 'defer'],
  ['三次会に行って', 'go-to'],
];

describe('pass CCCXXXV: party/reception/event end idioms (magnolia)', () => {
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
