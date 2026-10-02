/**
 * Voice atoms CCCXXIII — farm season-end & harvest-in idioms (EN)
 * + 収穫終了/刈り入れ/蔵納め (JA). Harvest is in = close the tab.
 * Planting, growing, and mid-season chores stay out.
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
  // --- harvest done ---
  'harvest in', 'harvest is in', 'harvest done',
  'harvest over', 'harvest finished', 'crops are in',
  'crop is in', 'all the grain in', 'wheat is in',
  'corn picked', 'last row picked', 'last bale',
  'last bale stacked', 'hay is in', 'hay baled',
  'fields harvested', 'field cleared', 'fields plowed under',
  'gleanings done', 'harvest moon set',
  // --- storage / put to bed ---
  'silos full', 'silo filled', 'granary full',
  'bin full', 'cellar stocked', 'pantry stocked',
  'barn stocked', 'hay loft full', 'root cellar stocked',
  'canned the last jar', 'canning done', 'preserves done',
  'jam jarred', 'pickles jarred', 'harvest stored',
  'crop put away', 'grain put away', 'winter stores in',
  // --- machinery / animals ---
  'combine parked', 'combine put away', 'tractor in the shed',
  'tractor parked', 'plow hung up', 'implements put away',
  'equipment winterized', 'tools oiled and stored',
  'milking done', 'last milking', 'herd in the barn',
  'cattle wintered', 'flock penned', 'horses stabled',
  'last of the herd sold', 'pasture empty', 'coop locked',
  // --- season end / winter prep ---
  'barn closed up', 'shed locked for winter',
  'garden put to bed', 'fields put to bed', 'beds mulched',
  'winter wheat in the ground', 'cover crop in',
  'frost came early', 'first frost fell', 'ground froze',
  'growing season over', 'season wrapped', 'fields at rest',
  'market season ended', 'csa delivered', 'last csa box',
];

const closeTabJa = [
  // --- 収穫終了 ---
  '収穫終了', '収穫が終わって', '収穫完了', '収穫を終えて',
  '刈り入れ終了', '刈り入れが終わって', '刈り取り完了',
  '稲刈り終わり', '稲刈り終了', '稲を刈り終えて',
  '麦刈り終了', '芋掘り終了', '収穫祭終了', '実りの秋終了',
  '畑を刈り終えて', '圃場を刈り終えて', '最終収穫',
  // --- 納め/貯蔵 ---
  '蔵に納めて', '蔵にしまって', '倉に納めて',
  '穀物を蔵に入れて', 'サイロが満たされて', '穀倉が満たされて',
  '納屋に納めて', '納屋を締めて', '干し草を納めて',
  '藁を積み終えて', '俵を積んで', '米俵を積み終えて',
  '冬囲い', '冬支度', '越冬準備完了', '根菜を埋めて',
  '漬物を仕込んで', '味噌を仕込んで', '保存食を作り終えて',
  '収穫物をしまって', '冬の蓄え完了', '備蓄完了',
  // --- 機械/家畜 ---
  'トラクターをしまって', 'コンバインを納めて',
  '農機具をしまって', '鍬をしまって', '鎌を研いで納めて',
  '機械を冬囲いして', '牛を厩に入れて', '家畜を厩に戻して',
  '鶏を小屋に入れて', '放牧を終えて', '牧草を刈り終えて',
  '搾乳終了', '最後の搾乳', '出荷完了', '最終出荷',
  '出荷を終えて', '朝市終了', '直売所を閉めて',
  // --- 冬休み/休耕 ---
  '畑を休ませて', '圃場を休ませて', '休耕に入って',
  '麦を播き終えて', '秋まき完了', '霜が降りて',
  '初霜が降りて', '地面が凍って', '農閑期',
  '農作業を終えて', '今年の農作業終了', '耕起終了',
];

const negate = [
  'keep harvesting', 'stay in the fields', 'keep the farm going',
  'still harvesting', 'まだ収穫中',
  '農作業を続けて', '刈り入れを続けて', '畑仕事を続けて',
];

const nullPins = [
  // planting / growing / mid-season
  'planting season', 'seeds planted', 'seeds in the ground',
  'sprouts coming up', 'crops growing', 'fields green',
  'midseason', 'irrigation running', 'weeding done',
  'harvest coming', 'almost ripe', 'still growing',
  '種まき', '田植え', '植え付け完了', '発芽して',
  '成長中', '生育中', '耕作中', '水やり中',
  '草刈り中', '収穫前', '実り始めて', '開花期',
];


describe('Voice atoms CCCXXIII — farm season-end & harvest-in idioms', () => {
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
});
