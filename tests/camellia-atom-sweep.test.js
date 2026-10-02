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
  // laundry
  'laundry done', 'laundry folded', 'clothes folded',
  'folded the laundry', 'dryer done', 'load finished',
  'wash cycle done', 'washer emptied', 'clothes hung',
  'hung out the laundry', 'line dried', 'brought in the laundry',
  'ironing done', 'ironed the shirts', 'dry cleaning picked up',
  'picked up dry cleaning', 'sewing done', 'mended the shirt',
  'buttons sewn',
  // kitchen / cooking
  'kitchen cleaned', 'dinner done', 'dinner ready',
  'meal prepped', 'meal prep done', 'cooking done',
  'finished cooking', 'dishes done', 'dishes washed',
  'washed the dishes', 'dishwasher emptied', 'dishwasher loaded',
  'dishwasher ran', 'pots scrubbed', 'counter wiped',
  'table wiped', 'sink cleaned', 'fridge cleaned',
  'oven cleaned', 'stove wiped',
  // floors / rooms
  'floor mopped', 'mopped the floor', 'floor swept',
  'swept the floor', 'vacuumed', 'vacuuming done', 'roomba done',
  'dusted', 'dusting done', 'windows cleaned', 'bathroom cleaned',
  'toilet scrubbed', 'shower scrubbed', 'tub cleaned',
  'mirror wiped',
  // trash / pets / plants
  'trash taken out', 'took out the trash', 'garbage out',
  'bins out', 'recycling out', 'litter box cleaned',
  'fed the pets', 'pets fed', 'dog walked', 'walked the dog',
  'plants watered', 'watered the plants',
  // bedroom / organizing
  'made the bed', 'sheets changed', 'changed the sheets',
  'towels replaced', 'decluttered', 'organized the closet',
  'closet organized', 'tidied up', 'cleaning done',
  'finished cleaning', 'house cleaned',
  // errands
  'all chores done', 'chore list done', 'errands done',
  'errands run', 'shopping done', 'groceries done',
  'grocery run done', 'brought in the groceries',
  'unpacked the groceries', 'mailbox checked', 'mail sorted',
  'bills paid', 'paid the bills',
];
const closeTabJa = [
  // 洗濯
  '洗濯終了', '洗濯が終わって', '洗濯物を畳んで',
  '洗濯物をたたんで', '洗濯物を干して', '干し終えて',
  '洗濯物を取り込んで', '乾燥が終わって', '乾燥機が止まって',
  '洗濯機が止まって', 'アイロン終了', 'アイロンをかけて',
  'クリーニングを取って', 'クリーニングを受け取って',
  '裁縫終了', 'ボタンをつけて', 'ほつれを直して',
  // 料理/食事
  '料理終了', '料理ができて', '晩ご飯ができて', '夕食準備完了',
  'ご飯が炊けて', '炊飯が終わって', 'おかずを作って',
  '作り置き完了', '仕込み終了', '盛り付け終了',
  '食器を洗って', '皿洗い終了', '洗い物終了', '食洗機に入れて',
  '食洗機が終わって', '鍋を洗って', 'シンクを磨いて',
  'カウンターを拭いて', '冷蔵庫を整理して', '換気扇を掃除して',
  'ガス台を拭いて',
  // 掃除
  '床を拭いて', '拭き掃除終了', '掃除終了', 'ルンバが終わって',
  '雑巾がけして', '窓を拭いて', '風呂掃除終了', '風呂を掃除して',
  'トイレ掃除終了', '洗面所を掃除して', '鏡を磨いて',
  // ゴミ/ペット/植物
  'ゴミを出して', 'ゴミ出し終了', 'ゴミを捨てて',
  '燃えるゴミを出して', '資源ゴミを出して', '猫のトイレを掃除して',
  '餌をあげて', 'ペットに餌をやって', '犬の散歩終了',
  '散歩から帰って', '植物に水をやって', '水やり終了',
  // 寝室/整理
  'ベッドを整えて', 'シーツを替えて', '布団を干して',
  '布団を畳んで', 'タオルを替えて', '断捨離終了',
  'クローゼットを整理して', '部屋を片付けて', '片付け終了',
  '家事終了', '家事が終わって', '全家事終了',
  // 買い物/外出
  '買い物済ませて', '買い出し終了', '食材を買って',
  '買い物から帰って', '郵便を取り込んで', '郵便受けを見て',
  '公共料金を払って', '振り込みを済ませて',
];
const negate = [
  'still cleaning', 'still cooking', 'keep cleaning',
  'still doing laundry', 'more chores to do', 'a few more chores',
  'one more load', 'still washing', 'keep scrubbing',
  'still tidying',
  'まだ掃除中', 'まだ洗濯中', 'まだ料理中', '洗濯を続けて',
  '掃除を続けて',
];
const nullPins = [
  'laundry in the dryer',
  '洗濯中', '料理中', '掃除中', '洗い物がある', 'ゴミが溜まって',
];
const establishedPins = [
  ['kitchen closed', 'close-tab'], ['bed made', 'close-tab'],
  ['chores done', 'close-tab'], ['テーブルを拭いて', 'close-tab'],
  ['掃除が終わって', 'close-tab'], ['掃除機をかけて', 'close-tab'],
  ['整理整頓して', 'close-tab'], ['荷物を受け取って', 'close-tab'],
  ['明日掃除', 'defer'],
];

describe('pass CCCXXXIX: chores/laundry/cooking end idioms (camellia)', () => {
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
