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
  // con floor end
  'con done', 'convention done', 'last panel done',
  'panels over', 'badge turned in', 'lanyard off',
  'dealer room closed', 'artist alley closed',
  'vendor hall emptied',
  // shopping / circles
  'bought the doujinshi', 'circle shopping done',
  // cosplay wrap
  'cosplay off', 'out of cosplay',
  'changed back to street clothes',
  'photoshoot done con', 'autograph session done',
  'ticket scanned out', 'exhibitor pass off',
  // exhibitor side
  'table packed artist', 'sold out my booth',
  'stock all gone',
  // multi-day
  'after party con done', 'con exhaustion hit',
  'eve of con done', 'circle tickets bought',
  'hand stamp off', 'event over venue',
  'con weekend done', 'first day con done',
  'day one done con', 'masquerade done',
  'contest judged', 'cosplay contest done',
];
const closeTabJa = [
  'コミケ終了', 'イベントが終わって', 'イベント終了',
  '会場を出てイベント', '最後のパネルを聞いて',
  'サークル回り終了', '買い回り終了',
  '戦利品を抱えて', '新刊を買って', '新刊セット',
  '委託を取り終えて', 'スペースを畳んで',
  '在庫を売り切って', '完売しました',
  '更衣室を出てイベント', '私服に戻って',
  '撮影会終了', 'サイン会終了',
  '行列を抜けてイベント', 'スタッフパスを返して',
  '東ホールを出て', '西ホールを出て',
  'ビッグサイトを出て', 'アフター終了',
  '一日目終了', '初日終了イベント',
  '撤収しました', '搬出終了',
];
const negate = [
  'still at the con', 'まだイベント中',
];
const nullPins = [
  'about to con', 'mid con', 'con schedule',
  'dealer room', 'panel room', 'artist alley',
  'con badge',
  'イベントの途中', 'これからイベント', 'サークルリスト',
];
const establishedPins = [
  ['meet and greet done', 'close-tab'],
  ['booth torn down', 'close-tab'],
  ['hall emptied', 'close-tab'],
  ['ブースを畳んで', 'close-tab'],
  ['コスプレを脱いで', 'close-tab'],
  ['con tomorrow', 'date'], ['明日イベント', 'defer'],
  ['カタログを開いて', 'go-to'],
];

describe('pass CCCLXII: con & doujin-event end idioms (mahogany)', () => {
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
