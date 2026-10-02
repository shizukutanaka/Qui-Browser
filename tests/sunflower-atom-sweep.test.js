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
  // bins out / collection
  'trash is out', 'put the bins out', 'bins on the curb',
  'cans on the curb', 'curbside set', 'trash day done',
  'trash collected', 'garbage truck came', 'truck came by',
  'bins emptied', 'bins back in', 'brought the bins in',
  'cans back in',
  // sorting / recycling
  'recycling sorted', 'sorted the recycling',
  'cardboard broken down', 'boxes flattened',
  'cans crushed', 'bottles rinsed', 'compost out',
  'food scraps out',
  // yard waste
  'yard waste out', 'leaves bagged', 'raked the leaves',
  'bagged the leaves', 'grass clippings bagged',
  // bulky / donation runs
  'junk hauled', 'hauled the junk', 'dumpster run done',
  'dump run done', 'donation drop off done',
  'dropped off donations', 'goodwill run done',
  'old furniture out', 'mattress out', 'bulky item out',
  // indoor cleaning
  'sweep done', 'swept up', 'dustpan emptied',
  'vacuum done', 'mopped', 'mop done', 'floors done',
  'wiped down', 'surfaces wiped', 'glass cleaned',
  'sink emptied', 'drain cleared', 'vent dusted',
  'filters swapped', 'lint trap emptied',
  'dryer vent cleaned', 'picked up around',
  'purged the closet',
];
const closeTabJa = [
  // ゴミ出し
  'ゴミを出してきた', '燃えないゴミを出して',
  'プラスチックを出して', 'ペットボトルを出して',
  '缶を出して', '瓶を出して', '段ボールを出して',
  '新聞を出して', '雑誌を束ねて', '古紙を出して',
  '生ゴミを出して',
  // 収集/袋
  '収集が終わって', '回収が終わって',
  '回収車が来て', 'ゴミ袋を縛って', '袋を結んで',
  // 分別
  'ゴミを分けて', '分別をして', '分別終了',
  // 粗大/不用品
  '粗大ゴミを出して', '不用品を出して',
  '家具を出して', '家電を出して',
  // 庭/掃除
  '枝を束ねて', '落ち葉を集めて',
  '落ち葉を袋に入れて', '草むしりをして',
  '剪定ゴミを出して', '掃き掃除をして', '床を掃いて',
  'ちり取りを使って', 'モップをかけて',
  '雑巾がけをして', '拭き掃除をして',
  'トイレを掃除して', '排水口を掃除して',
  'フィルターを替えて', '埃を払って', '棚を拭いて',
  '整頓して',
];
const negate = ['still taking out trash'];
const nullPins = [
  'mid clean', 'cleaning ongoing', 'half the house done',
  'about to take out the trash', 'ゴミ袋', '掃除機',
  'これからゴミ出し', '掃除の途中',
];
const establishedPins = [
  ['took out the trash', 'close-tab'],
  ['garbage out', 'close-tab'], ['bins out', 'close-tab'],
  ['recycling out', 'close-tab'],
  ['floor swept', 'close-tab'], ['vacuumed', 'close-tab'],
  ['counters wiped', 'close-tab'],
  ['windows cleaned', 'close-tab'],
  ['shower scrubbed', 'close-tab'],
  ['toilet scrubbed', 'close-tab'],
  ['bathroom cleaned', 'close-tab'],
  ['chores done', 'close-tab'], ['cleaning done', 'close-tab'],
  ['house cleaned', 'close-tab'], ['tidied up', 'close-tab'],
  ['decluttered', 'close-tab'], ['garbage day', 'close-tab'],
  ['収集日', 'close-tab'],
  ['ゴミ出し終了', 'close-tab'], ['ゴミを出して', 'close-tab'],
  ['燃えるゴミを出して', 'close-tab'],
  ['資源ゴミを出して', 'close-tab'],
  ['集積所に出して', 'close-tab'],
  ['ゴミ置き場に出して', 'close-tab'],
  ['リサイクルに出して', 'close-tab'],
  ['掃除機をかけて', 'close-tab'], ['窓を拭いて', 'close-tab'],
  ['風呂を掃除して', 'close-tab'],
  ['換気扇を掃除して', 'close-tab'],
  ['片付け終了', 'close-tab'], ['掃除が終わって', 'close-tab'],
  ['掃除終了', 'close-tab'], ['断捨離して', 'close-tab'],
  ['クローゼットを整理して', 'close-tab'],
  ['still cleaning', 'negate'], ['まだ掃除中', 'negate'],
  ['trash day tomorrow', 'date'],
  ['collection tomorrow', 'date'],
  ['明日ゴミ出し', 'defer'],
];

describe('pass CCCLIV: trash-out & cleaning end idioms (sunflower)', () => {
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
