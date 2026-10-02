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
  // weeding & beds
  'garden weeded', 'beds weeded',
  'mulch laid', 'compost turned',
  // planting & pruning
  'plants repotted', 'seedlings transplanted',
  'bulbs planted', 'roses pruned',
  'trees staked',
  // structures & wash
  'fence painted', 'deck stained',
  'pressure washing done', 'gutter cleaned',
  'leaves raked', 'snow shoveled',
  // wrap-up
  'tools put away', 'shed locked',
  'watering done',
];
const closeTabJa = [
  '草むしり終了', '草刈り終了',
  '芝刈り終了', '生垣を刈って',
  'マルチを敷いて', '堆肥を返して',
  '道具をしまって', '物置を閉めて',
  '植え替え終了', '苗を植えて',
  '球根を植えて', 'バラを剪定して',
  '支柱を立てて', '柵を塗って',
  'デッキを塗って', '高圧洗浄終了',
  '雨樋を掃除して', '雪かき終了',
];
const negate = [
  'still gardening', 'still weeding',
  'まだ作業中', 'まだ草むしり中',
];
const nullPins = [
  'about to weed', 'mid weeding',
  'seed catalog', 'garden gloves',
  '作業の途中', 'これから水やり',
  '種のカタログ', '軍手',
];
const establishedPins = [
  ['lawn mowed', 'close-tab'], ['hedge trimmed', 'close-tab'],
  ['水やり終了', 'close-tab'], ['落ち葉を掃いて', 'close-tab'],
  ['明日草むしり', 'defer'],
];

describe('pass CCCLXXXV: garden & yard-work end idioms (tansy)', () => {
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
