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
  // retrofit completed & performance rating obtained
  'retrofit completed', 'performance rating obtained',
];
const closeTabJa = [
  // 耐震
  '耐震基準', '耐震改修',
  '耐震診断', '住宅耐震',
  // 省エネ・性能評価
  '断熱等級', '省エネ基準',
  '省エネ住宅', '長期優良住宅',
  '認定長期優良住宅', '低炭素住宅',
  '住宅性能評価', '建設住宅性能評価',
  '住宅性能表示',
  // 瑕疵・助成・税制
  '瑕疵担保', '瑕疵担保保険',
  'ホームインスペクション', 'リフォーム助成',
  'フラット35', '住宅ローン減税',
  'すまい給付金', '不動産取得税',
  // 既存・宅地
  '既存住宅', '中古住宅',
  '新築住宅', '建売住宅',
  '宅地造成', '擁壁',
  '造成宅地防災', '地盤調査',
  '地盤補強', '液状化',
  '盛土規制',
  // 建築制限
  '日影規制', '建蔽率',
  '斜線規制',
];
const negate = [
  'still awaiting the seismic rating',
  'まだ診断前', 'まだ着工前',
];
const nullPins = [
  'about to file the inspection report',
  'about to join the builders guild',
];
const establishedPins = [
  ['容積率', 'close-tab'],
  ['inspection passed', 'close-tab'],
  ['certificate issued', 'security-status'],
  ['seismic check done', 'mic-status'],
  ['まだ検査前', 'negate'],
];

describe('pass DCLXXV: housing performance & seismic administration (sheaf)', () => {
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
