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
  // reactor licensed & inspection completed
  'reactor licensed', 'inspection completed',
];
const closeTabJa = [
  // 規制機関・法制
  '原子力規制庁', '原子力規制',
  '原子力基本法', '原子炉等規制法',
  '放射線障害防止法', '新規制基準',
  // 管理・審査
  '放射線管理', '核物質管理',
  '適合性審査', '安全審査',
  '運転期間延長', '定期検査報告',
  // 燃料・施設
  '使用済燃料', '再処理',
  '廃止措置', '特定原子力施設',
  '原子力事業者', '核燃料',
  '廃炉', '原発',
  '原子炉', '燃料棒',
  '軽水炉', '高速増殖炉',
  // 安全・防災
  '避難計画', '避難経路',
  '原子力災害対策', '原子力緊急事態',
  '原子力防災', '原子力安全',
  '重大事故対策', '放射線監視',
  '原子力防災組織', '放射線',
];
const negate = [
  'still awaiting the license decision',
  'これから検査', 'まだ運転前',
];
const nullPins = [
  'about to file the reactor report',
  'about to tour the nuclear plant',
];
const establishedPins = [
  ['原子力規制委員会', 'close-tab'],
  ['定期検査', 'close-tab'],
  ['原子力発電所', 'close-tab'],
  ['still awaiting the safety review', 'negate'],
  ['まだ審査中', 'negate'],
  ['まだ認可前', 'negate'],
];

describe('pass DCLXXI: nuclear regulation administration (shale)', () => {
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
