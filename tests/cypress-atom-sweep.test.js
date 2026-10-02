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
  // knitting finish
  'sweater finished', 'cast off the stitches',
  'cast off done', 'scarf done knitting',
  'muffler finished', 'blanket done knitting',
  'sock pair done', 'yarn ended',
  'yarn ran out', 'needles down',
  // sewing / embroidery finish
  'hems sewn', 'buttons sewn on',
  'dress sewn', 'pattern finished sewing',
  'seam ripped back', 'thimble put away',
  'bobbins wound', 'embroidery framed',
  'cross stitch done', 'quilt bound',
  // other crafts
  'loom warped off', 'woven scarf done',
  'crochet done', 'granny squares done',
  'costume finished', 'cosplay done costume',
  'crafts done', 'diy done',
  'workshop done craft', 'craft fair ready',
];
const closeTabJa = [
  '編み物終了', 'セーターを編み終えて',
  '最後の一目', '伏せ止めをして',
  'マフラーを編み上げて', 'キルトを仕上げて',
  '刺繍を額に入れて', '毛糸が尽きて',
  '編み針を置いて', '裾を縫って',
  '衣装完成', 'コスプレ衣装終了',
  '手芸終了', 'ミシンをしまって',
  '編み物を仕舞って', 'パッチワーク終了',
  'あみもの完成', 'ハンドメイド完成',
  '手作り完成', '羊毛フェルト終了',
  'クロスステッチ終了', '裁縫箱をしまって',
];
const negate = [
  'still knitting', 'still sewing',
  'still crafting',
  'まだ編み物中', 'まだ裁縫中',
];
const nullPins = [
  'about to knit', 'mid knit',
  'yarn ball', 'knitting needles', 'sewing kit',
  'thimble',
  '編み物の途中', 'これから編み物',
  '毛糸', '裁縫箱', 'ミシン',
];
const establishedPins = [
  ['sewing done', 'close-tab'],
  ['ボタンをつけて', 'close-tab'],
  ['裁縫終了', 'close-tab'],
  ['明日編み物', 'defer'],
];

describe('pass CCCLXXIII: knitting & sewing finish idioms (cypress)', () => {
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
