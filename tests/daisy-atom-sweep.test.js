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
  // shopping done
  'shopping finished', 'done shopping', 'finished shopping',
  'ran the errands', 'errand run done',
  // checkout
  'checked out at the register', 'paid at the register',
  'register done', 'self checkout done', 'paid the cashier',
  'card tapped', 'paid by card', 'paid cash',
  'got the receipt',
  // bagging / cart
  'bags packed', 'bagged the groceries', 'groceries bagged',
  'cart emptied', 'cart returned', 'trolley back',
  'shopping cart put back',
  // load out / home
  'bags in the car', 'loaded the car', 'trunk loaded',
  'groceries home', 'groceries put away', 'fridge stocked',
  'costco run done', 'quick stop done',
  'convenience store stop', 'vending machine stop',
  // package / pickup
  'picked up the package', 'package picked up',
  'parcel collected', 'picked up the parcel',
  'delivery received', 'signed for the package',
  'package at the door', 'mail collected',
  'picked up the mail', 'post office run done',
  'laundry picked up', 'photos picked up',
  'prescription picked up', 'order picked up',
  'curbside done', 'drive thru done',
  // queue / store end
  'line waited out', 'waited in line', 'queue done',
  'crowd thinned', 'store closed shoppers',
  'last customer out', 'shopped till drop', 'mall closed',
  'sold out but got one', 'snagged the last one',
];
const closeTabJa = [
  // 買い物
  '買い物終了', '買い物が終わって', '買い物を終えて',
  'お買い物終了', '用事を済ませて', '用件を済ませて',
  // レジ/支払い
  'レジを済ませて', 'セルフレジ終了',
  'カードで支払って', '現金で払って', '電子マネーで払って',
  'ポイントを付けて', 'レシートをもらって',
  // 袋詰め/カート
  '袋に詰めて', '袋詰めをして',
  'カートを返して', 'カゴを戻して',
  // 積み下ろし/収納
  '荷物を車に乗せて', 'トランクに積んで',
  '買い物袋を下ろして', '食材をしまって',
  '冷蔵庫に入れて', 'まとめ買い終了', 'コストコ終了',
  '食料品を買って', 'コンビニを出て',
  '自動販売機で買って',
  // 受け取り
  '宅配便を受け取って', '荷物を取ってきた',
  '集荷所から取って', '宅配ボックスから出して',
  '受領印を押して', '不在票を回収して',
  '郵便を取ってきた', 'クリーニングを取ってきた',
  '洗濯物を取ってきた', '写真を取ってきた',
  '注文品を受け取って', '受け取り完了',
  '呼ばれて受け取って',
  // 行列/閉店
  '列を抜けて', '最後の一個を買って',
  '売り切れ寸前で買って', '閉店間際に買って',
];
const negate = [
  'still shopping', 'still in line', 'still queuing',
  'まだ買い物中', '行列の途中',
];
const nullPins = [
  'mid shop', 'cart half full', 'queue right now',
  'waiting for pickup', 'order ready',
  'package out for delivery', 'about to check out',
  'heading to the register', '買い物袋', 'レジ袋',
  'レシート', '精算中', '行列に並んで',
];
const establishedPins = [
  ['shopping done', 'close-tab'],
  ['errands done', 'close-tab'],
  ['receipt in hand', 'close-tab'],
  ['unpacked the groceries', 'close-tab'],
  ['pantry stocked', 'close-tab'],
  ['grocery run done', 'close-tab'],
  ['dry cleaning picked up', 'close-tab'],
  ['pickup done', 'close-tab'],
  ['買い出し終了', 'close-tab'],
  ['会計を済ませて', 'close-tab'],
  ['荷物を受け取って', 'close-tab'],
  ['shopping trip tomorrow', 'date'],
  ['grocery run tomorrow', 'date'],
  ['明日買い物', 'defer'], ['明日レジ', 'defer'],
  ['買い物に行って', 'go-to'],
];

describe('pass CCCLIII: shopping & pickup end idioms (daisy)', () => {
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
