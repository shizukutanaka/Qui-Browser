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
  // manifest signed & disposal permit granted
  'manifest signed', 'disposal permit granted',
];
const closeTabJa = [
  // 制度・マニフェスト
  '産廃', 'マニフェスト',
  '産業廃棄物管理票', '廃棄物行政',
  '産廃処理', '産業廃棄物税',
  // 種別
  '特別管理産業廃棄物', '有害産業廃棄物',
  '特定産業廃棄物', '解体廃棄物',
  '医療廃棄物', '感染性廃棄物',
  '廃プラスチック', '廃油処理',
  // 処理・許可
  '収集運搬', '廃棄物処理業者',
  '中間処理', '埋立処分',
  '処理委託', '委託契約',
  '廃棄物届出', '処理場整備',
  '処分業許可', '運搬業許可',
  // 排出・違法
  '排出事業者', '不法投棄',
  'アスベスト処理', '循環資源',
];
const negate = [
  'still awaiting the disposal permit',
  'まだ処分前', 'これから搬出',
];
const nullPins = [
  'about to file the manifest',
  'about to visit the disposal site',
];
const establishedPins = [
  ['産業廃棄物', 'close-tab'],
  ['廃棄物処理', 'close-tab'],
  ['廃棄物処理法', 'close-tab'],
  ['最終処分場', 'close-tab'],
  ['これから届出', 'negate'],
];

describe('pass DCLXXIV: industrial waste administration (shanty)', () => {
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
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
