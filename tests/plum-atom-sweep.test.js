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
  // DIY & small-renovation done
  'project done', 'painted the room',
  'shelf hung', 'shelves up',
  'furniture assembled', 'put together the shelf',
  'drilled the holes', 'mounted the tv',
  'curtain rods up', 'hooks hung',
  'wallpaper done', 'floor laid',
  'tiles grouted', 'renovation done',
];
const closeTabJa = [
  'diy終了', '日曜大工終了',
  '部屋を塗って', '棚をつけて',
  '家具を組み立てて', '組み立て終了',
  'テレビをつけて', 'カーテンレールをつけて',
  'フックをつけて', '壁紙を貼って',
  '床を張って', 'タイルを埋めて',
  'リフォーム終了',
];
const negate = [
  'still doing diy', 'still at the project',
  'まだdiy中', 'まだ塗装中',
];
const nullPins = [
  'about to assemble', 'mid project',
  'toolbox', 'drill',
  'これから組み立て', '作業の途中',
  '工具箱', '電動ドリル',
];
const establishedPins = [
  ['diy done', 'close-tab'],
  ['still painting', 'negate'],
  ['穴を開けて', 'go-to'],
];

describe('pass CDVI: DIY & small-renovation idioms (plum)', () => {
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
