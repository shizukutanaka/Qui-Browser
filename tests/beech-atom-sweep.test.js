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
  // shoot end
  'photo session done', 'photoshoot done',
  'shoot wrapped photo', 'headshots done',
  'passport photo taken', 'portrait session done',
  'graduation photos done', 'yearbook photos done',
  'product shoot done', 'lookbook shot',
  'wedding shots delivered', 'ceremony shots done',
  // processing / film
  'shots backed up', 'sd card emptied',
  'film developed', 'rolls dropped off',
  'film scanned', 'darkroom session done',
  'darkroom closed',
  // edit & delivery
  'album delivered', 'prints ordered',
  'edited the batch', 'posted the set',
  'gallery delivered', 'sneak peek sent',
  'contact sheet done', 'edits approved',
  'final selects done', 'culled the shots',
  'culled them all', 'raw files archived',
];
const closeTabJa = [
  '撮影が終わって写真', '写真を撮り終えて',
  '現像を出して', 'プリントを受け取って',
  'アルバムを渡して', 'カメラをしまって',
  'データをバックアップして写真', 'sdカードを空にして',
  'モデルが帰って', '七五三撮影終了',
  '証明写真を撮って', '卒業写真終了',
  '家族写真終了', '商品撮影終了',
  'ロケ撮影終了', '写真を現像して',
  'フィルムを出して', 'セレクトを終えて',
  'レタッチ終了', '写真を納品して',
  'アルバムを納品して', 'ギャラリーを共有して',
  '写真データを渡して', '撮影データを渡して',
];
const negate = [
  'still shooting photo', 'still editing photos',
  'まだ撮影中', 'まだ編集中写真',
];
const nullPins = [
  'about to shoot', 'mid shoot', 'camera bag',
  'tripod', 'lens cap', 'film roll',
  '撮影の途中', 'これから撮影',
  '三脚', 'レンズ', 'フィルム',
];
const establishedPins = [
  ['撮影会終了', 'close-tab'],
  ['photoshoot tomorrow', 'date'], ['明日撮影', 'defer'],
];

describe('pass CCCLXIX: photoshoot & darkroom end idioms (beech)', () => {
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
