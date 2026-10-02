const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  return new VoiceCommands({ speak: () => {}, onCommand: () => {} });
}
const key = (vc, p) => vc._matchCommand(p).key;

const closeTab = [
  // moved
  'moved', 'moved in', 'moved out', 'all moved in', 'relocated',
  'the move is done', 'moving day over', 'new home', 'settled in',
  'home sweet home', 'first night in', 'housewarming party done',
  // unpacked / set up
  'boxes unpacked', 'unpacked', 'last box empty', 'all boxes gone',
  'furniture arranged', 'couch in place', 'bed made', 'desk set up',
  'walls painted', 'shelves mounted', 'internet hooked up',
  'utilities on', 'power is on', 'gas turned on', 'water running',
  // paperwork / old place
  'address changed', 'mail forwarded', 'dmv updated',
  'license updated', 'voter registration moved',
  'old place cleaned', 'old apartment empty', 'keys turned in',
  'deposit back', 'security deposit returned', 'final walkthrough done',
  // movers / truck
  'movers gone', 'truck returned', 'van unloaded', 'uhaul returned',
  'packing done', 'last load hauled', 'everything moved',
];

const closeTabJa = [
  // 引っ越し完了
  '引っ越し完了', '引っ越しました', '引っ越しが終わって', '転居',
  '転居しました', '転居完了', '新居に入って', '新生活開始',
  '引っ越し業者が帰って', '荷物を運び終えて', '全部運び終えて',
  '最初の夜', '入居日', '入居しました',
  // 荷解き/設営
  '荷解き終了', '荷解きが終わって', '荷ほどき終了',
  '段ボールを全部開けて', '家具を配置して', 'ベッドを組み立てて',
  '棚を取り付けて', 'カーテンをつけて', '壁を塗り終えて',
  '電気が通って', '水道が通って', 'ガス開栓', 'ネットが繋がって',
  'インターネット開通',
  // 手続き/旧宅
  '住所変更', '転居届を出して', '転出届を出して', '転入届を出して',
  '郵便転送', '郵便物を転送して', '免許証を書き換えて', '契約書にサインして',
  '旧宅を出て', '旧居を引き払って', '前の家を出て', '旧宅を掃除して',
  '原状回復', '敷金が戻って', '鍵を渡して', '退去しました',
  '退去日', '引き渡し検査', '立ち会い検査終了',
];

const negate = [
  'stay in the old place', 'keep packing', 'dont move yet',
  'still unpacking', 'まだ引っ越し中', 'まだ荷解き中',
  '荷造りを続けて', '旧居に残って',
];

const nullPins = [
  // in progress
  'packing boxes', 'mid move', 'moving soon', 'move planned',
  'waiting for the movers', 'boxes everywhere', 'still packing',
  'house hunting', 'looking for a place', '引っ越し中',
  '引っ越し予定', '荷造り中', '荷解き中', '物件探し中',
  '内見予定', '引越業者待ち', '退去手続き中',
];

const establishedPins = [
  ['housewarming done', 'close-tab'],
  ['鍵を返して', 'close-tab'],
  ['wifi set up', 'online-status'],
  ['wifi開通', 'online-status'],
  ['段ボールを開けて', 'go-to'],
  ['ダンボールを開けて', 'go-to'],
  ['pack it in', 'stop-everything'],
];

describe('Voice atoms CCCXXXI — moving/relocation done', () => {
  test.each(closeTab)('"%s" -> close-tab', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => ({ pinned: false }), closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each(closeTabJa)('"%s" -> close-tab (JA)', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => ({ pinned: false }), closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each(negate)('"%s" -> negate', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => null, closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe('negate');
  });

  test.each(nullPins)('"%s" -> null (in progress)', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => null, closeTab: () => {}, tabs: () => [] });
    expect(vc._matchCommand(p)).toBeNull();
  });

  test.each(establishedPins)('"%s" -> %s (pre-existing)', (p, k) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => null, closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe(k);
  });
});
