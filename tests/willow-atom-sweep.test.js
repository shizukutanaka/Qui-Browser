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
  // route end
  'route done', 'route complete', 'finished the route',
  'last stop done', 'all deliveries done', 'deliveries done',
  'packages delivered', 'all packages delivered',
  'last package delivered', 'manifest cleared', 'manifest done',
  'route sheet done', 'delivered everything', 'everything delivered',
  'all stops done', 'last house done', 'neighborhood done',
  'block done', 'route sheet empty', 'zero stops left',
  'no stops left', 'route zero', 'route finished early',
  // vehicle / cargo
  'truck empty', 'van empty', 'truck unloaded',
  'cargo delivered', 'freight delivered', 'haul done',
  'load dropped', 'load delivered', 'dropped the load',
  'dock done', 'loading dock done',
  // proof of delivery
  'signed the pod', 'pod signed', 'proof of delivery',
  'delivery confirmed', 'recipient signed', 'signature captured',
  'left at the door', 'porch delivered', 'mailbox stuffed',
  'pod uploaded', 'scanner docked', 'scanner synced',
  // mail / papers / milk
  'mail delivered', 'mail run done', 'mail route done',
  'paper route done', 'papers delivered', 'milk run done',
  'sorted and delivered', 'parcels sorted', 'bags emptied',
  'mailbag empty', 'satchel empty',
  // pickups / returns
  'pickup done delivery', 'collections done', 'all pickups made',
  'returns collected', 'empty returns', 'sorted the returns',
  'returns dropped',
  // back at base / shift end
  'back at the depot', 'back at the warehouse',
  'route done driving', 'clocked out driving', 'log closed',
  'logbook done', 'eod delivery', 'end of shift driving',
  'delivery shift done', 'warehouse done', 'back at the hub',
  'hub returned', 'van parked', 'truck parked',
  'shift over driving', 'rain or shine done',
  'morning route done', 'evening route done',
  'night route done', 'weekend route done',
  'courier done', 'dispatch done', 'radioed in',
  'called it in', 'proof uploaded', 'dps done',
];
const closeTabJa = [
  // 配達終了
  '配達終了', '配達完了', '配達が終わって', '配達を終えて',
  '全配達終了', '全件配達', '全部配って', '最後の配達',
  'ラストの配達', 'ルート終了', 'ルートを終えて',
  '回り終えて', '集配終了', '配達リストを終えて',
  '荷物を全部届けて', '全荷物を届けて', '届け終わって',
  '届け物を済ませて',
  // 集荷/引き取り/荷役
  '不在票を入れて', '再配達を済ませて', '再配達終了',
  '引き取り終了', '集荷終了', '集荷を済ませて',
  '荷受け終了', '荷下ろし終了', '積み下ろし終了',
  '荷積み終了', 'トラックを空にして', '荷台が空いて',
  // 帰庫
  '車庫に戻って', '営業所に戻って', '倉庫に戻って',
  '集配所に戻って', '拠点に戻って', '帰庫しました',
  '帰庫して', '車を止めて', 'バンを停めて',
  // 証明/締め
  'サインをもらって', '受領印をもらって', '受領証をもらって',
  '配達証明', '不在票完了', '置き配完了',
  '宅配ボックスに入れて', 'メーターを締めて', '日報を書いて',
  '日報終了', '伝票を締めて', '配達員が帰って',
  // 新聞/郵便/出前
  '新聞配達終了', '朝刊を配って', '夕刊を配って',
  '牛乳配達終了', 'フードデリバリー終了', '出前終了',
  'ウーバーを終えて', 'ラストオーダー配達', '深夜便終了',
  '朝便終了', '便が終わって', '郵便配達終了',
  '郵便を配って', 'ポストを回って', 'メール便終了',
];
const negate = [
  'still on route', 'still delivering', 'more stops',
  'still out delivering', 'まだ配達中', 'まだルート中',
  'まだ集荷中',
];
const nullPins = [
  'mid route', 'on the route', 'packages left to deliver',
  '残りの配達', '配達の途中', '配達中', '集荷中', 'ルート中',
  '早朝配達',
];
const establishedPins = [
  ['van unloaded', 'close-tab'], ['returned to base', 'close-tab'],
  ['pickups done', 'close-tab'], ['mail sorted', 'close-tab'],
  ['巡回終了', 'close-tab'], ['まだ残ってる', 'describe-tab'],
  ['route tomorrow', 'date'], ['early route tomorrow', 'date'],
  ['明日配達', 'defer'], ['明日集荷', 'defer'],
];

describe('pass CCCXLIII: delivery route end idioms (willow)', () => {
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
