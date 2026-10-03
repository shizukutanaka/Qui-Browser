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
  // license exam passed & board certification renewed
  'license exam passed', 'board certification renewed',
];
const closeTabJa = [
  // 歯科系
  '歯科医師', '歯科衛生士',
  '歯科技工士',
  // 看護系
  '看護師', '准看護師',
  '認定看護師', '専門看護師',
  '特定看護師', '看護師国家試験',
  // リハビリ系
  '理学療法士', '作業療法士',
  '言語聴覚士', '視能訓練士',
  '義肢装具士', '臨床工学技士',
  // 検査系
  '臨床検査技師', '診療放射線技師',
  // あはき・柔整
  'あん摩マッサージ指圧師', 'はり師',
  'きゅう師', '柔道整復師',
  // 福祉・支援系
  '精神保健福祉士', 'ケアマネージャー',
  '社会福祉士', '就労移行支援員',
  '生活支援員', '職業指導員',
  '移動支援従業者',
  // 栄養・販売
  '栄養士', '管理栄養士',
  '登録販売者',
  // 士業・心理
  '海事代理士', '行政書士',
  '公認心理師', '臨床心理士',
  // 研修
  '喀痰吸引等研修',
];
const negate = [
  'still awaiting the license exam',
  'まだ合格前', 'これから受験',
  'まだ受験前',
];
const nullPins = [
  'about to sit the board exam',
  'about to renew the license',
];
const establishedPins = [
  ['保健師', 'close-tab'],
  ['助産師', 'close-tab'],
  ['救急救命士', 'close-tab'],
  ['医療ソーシャルワーカー', 'close-tab'],
  ['介護支援専門員', 'close-tab'],
  ['土地家屋調査士', 'close-tab'],
  ['児童指導員', 'close-tab'],
  ['サービス管理責任者', 'close-tab'],
  ['福祉用具専門相談員', 'close-tab'],
  ['まだ登録前', 'negate'],
];

describe('pass DCLXXVIII: allied-health professions (shimmy)', () => {
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
