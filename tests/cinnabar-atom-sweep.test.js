// Voice atoms CCC: EN kitchen/meal-disposal idioms + JA 調理/食事/片付け chains (pass CCCII)
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ title: 'Example Page', url: 'https://example.com' }),
    closeTab: () => {},
    tabs: [{ title: 'Example Page' }],
  });
  return vc;
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

const closeTab = [
  // --- table/plate clear + dish cleanup ---
  'clear the table', 'clear the plates', 'wash the dishes', 'do the dishes',
  'dry the dishes', 'put the dishes away', 'scrape the plate',
  'lick the plate clean', 'clean your plate', 'empty plate',
  'last bite', 'final bite', 'clean plate club', 'finish your food',
  'bus the table', 'wipe the table', 'mop the floor with it',
  'sweep it into the bin', 'kitchen closed', 'orders up',
  'chefs kiss goodbye',
  // --- dog scraps / takeaway ---
  'feed it to the dog', 'give it to the dog', 'scraps for the dog',
  'doggy bag it', 'doggie bag', 'to-go box', 'leftovers for it',
  'make it leftovers', 'second helping of nothing',
  // --- cooked/done idioms ---
  'cook its goose', 'goose is cooked', 'turkey is done',
  'stick a fork in it', 'fork it', 'skewer it', 'skewer the tab',
  // --- cut/prepare verbs ---
  'slice and dice it', 'mince it', 'grate it', 'blend it', 'liquidize it',
  'dice it up', 'chop it fine', 'julienne it', 'cube it',
  'shred it coleslaw-style',
  'bone it', 'debone it', 'fillet it', 'gut and scale it', 'shuck it',
  'shell it', 'husk it', 'peel it', 'skin it', 'core it',
  // --- destructive cooking ---
  'fry it up', 'deep fry it', 'boil it alive', 'roast it', 'toast it',
  'burn it to a crisp', 'char it', 'blacken it', 'crisp it up',
  'cook it well done', 'overcook it', 'microwave it',
  // --- menu removal ---
  'eighty-six it', '86 it', 'off the menu', 'take it off the menu',
  'menu item removed', 'cut from the menu', 'dropped from the menu',
  'not on the menu anymore', 'sold out of it', 'all out of it',
  'last course', 'dessert time', 'check please',
  // --- established destructive-cooking literals (already close-tab) ---
  'saute it', 'braise it', 'tenderize it', 'simmer it down',
];

const closeTabJa = [
  // --- eat-finish = disposal ---
  '食べてしまって', '食べちゃって', '食べ尽くして', '平らげて', '完食して',
  '残さず食べて', 'きれいに食べて',
  // --- feed/leftover/scrap ---
  '犬にやって', '猫にやって', '餌にして', '餌食にして', 'エサにして',
  '生ゴミにして', '廃棄して', '残飯にして', '残り物にして',
  'お持ち帰りにして', '土産にして',
  // --- Xして捨てて chains ---
  '漬けて捨てて', '茹でて捨てて', '煮て捨てて', '焼いて捨てて',
  '揚げて捨てて', '蒸して捨てて', '炒めて捨てて',
  // --- burn/carbonize ---
  '焦がして', '真っ黒に焼いて', 'よく焼いて', 'こんがり焼いて',
  '丸焦げにして', '炭にして', '灰にして',
  // --- mince/grind/blend ---
  'ミンチにして', 'きざんで', '刻んで捨てて', 'すり潰して', '撹拌して',
  'ミキサーにかけて', '粉砕機で砕いて',
  // --- butcher/prep = dismantle ---
  '捌いて', 'さばいて', '三枚におろして', '骨を抜いて', '皮を剥いて',
  '殻を剥いて', '頭を落として', '内臓を抜いて', '芯を抜いて',
  'へたを取って', '筋を取って',
  // --- meal end / clear ---
  '皿を下げて', '食器を下げて', '食器を片付けて', 'テーブルを拭いて',
  '食事終わり', 'ごちそうさま', 'ご馳走様', 'お会計', 'お勘定',
  'チェックお願い',
  // --- takeaway / menu removal ---
  '出前を頼んで', '出前にして', '持ち帰りにして', 'デリバリーして',
  'メニューから外して', '品切れにして', '売り切れにして',
  '限定終了', '提供終了', '厨房を閉めて',
  // --- established garden-prep literal (already close-tab) ---
  '芽を摘んで',
];

describe('EN kitchen/meal-disposal idioms -> close-tab', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
});

describe('JA 調理/食事/片付け chains -> close-tab', () => {
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
});

describe('misroute fixes', () => {
  test('"second helping of nothing" -> close-tab (was scoped-help: help prefix inside "helping")', () => {
    expect(key(makeVC(), 'second helping of nothing')).toBe('close-tab');
  });
  test('"help me please" still -> help (boundary fix keeps the lookahead intact)', () => {
    expect(key(makeVC(), 'help me please')).toBe('help');
  });
  test('"help with volume" still -> scoped-help', () => {
    expect(key(makeVC(), 'help with volume')).toBe('scoped-help');
  });
});

describe('negate pins (keep-alive)', () => {
  test.each([['keep it open'], ['leave it open'], ['hold it open'],
    ['stay open'], ['残しておいて'], ['開けておいて'],
  ])('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
});

describe('null pins (transform/preserve, not disposal)', () => {
  test.each(['marinate it', 'brine it', 'pickle it', 'cure it',
    'dry age it', 'course by course', '漬物にして', '佃煮にして',
    '燻製にして', '種を取って',
  ])('"%s" stays null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
});
