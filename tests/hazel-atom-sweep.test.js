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
  // galleries / exhibition
  'museum visit done', 'galleries all seen',
  'last gallery done', 'exhibition done',
  'show closed museum', 'saw the exhibition',
  'guided tour done museum', 'audio guide returned',
  'map turned in', 'timed ticket done',
  'out of the exhibit',
  // shop
  'gift shop done museum', 'bought the catalog',
  'postcards bought', 'badge off museum',
  // zoo / aquarium
  'last tank seen', 'planetarium done',
  'feeding time seen', 'safari done park',
  'botanical garden done', 'conservatory done',
  // landmarks
  'observatory done', 'lighthouse climbed',
  'palace tour done', 'temple visit done',
  'stamp rally done', 'all stamps collected',
];
const closeTabJa = [
  '美術館終了', '博物館終了', '展示を見て',
  '全館見て', '最後の展示',
  '図録を買って', 'ポストカードを買って',
  'ミュージアムショップを出て',
  '音声ガイドを返して',
  '動物園終了', '水族館終了', '最後の水槽',
  'ショーが終わって水族館',
  '植物園を出て', '温室を出て',
  '展望台を降りて', 'お城を見て',
  '城巡り終了', '寺社を回って',
  '神社を参って', 'お寺を参って',
  'スタンプラリー終了',
];
const negate = [
  'still at the museum', 'まだ美術館',
];
const nullPins = [
  'about to museum', 'mid exhibit', 'museum map',
  'museum ticket', 'exhibit hall', 'audio guide',
  'gift shop',
  '美術館の途中', 'これから美術館',
  '入場券', '館内マップ',
];
const establishedPins = [
  ['museum done', 'close-tab'],
  ['left the museum', 'close-tab'],
  ['museum closed', 'close-tab'],
  ['exhibit done', 'close-tab'],
  ['zoo done', 'close-tab'],
  ['aquarium done', 'close-tab'],
  ['castle tour done', 'close-tab'],
  ['shrine visit done', 'close-tab'],
  ['美術館を出て', 'close-tab'],
  ['博物館を出て', 'close-tab'],
  ['展覧会を見て', 'close-tab'],
  ['展覧会終了', 'close-tab'],
  ['ガイドツアー終了', 'close-tab'],
  ['動物園を出て', 'close-tab'],
  ['水族館を出て', 'close-tab'],
  ['御朱印をもらって', 'close-tab'],
  ['museum tomorrow', 'date'], ['明日美術館', 'defer'],
];

describe('pass CCCLXIV: museum & exhibit end idioms (hazel)', () => {
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
