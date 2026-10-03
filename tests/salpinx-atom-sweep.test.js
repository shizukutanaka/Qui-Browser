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
  // cabinet order issued & agency regulation posted
  'cabinet order issued', 'agency regulation posted',
];
const closeTabJa = [
  '内閣府', '内閣官房',
  '首相官邸', '総理大臣',
  '国務大臣', '大臣政務官',
  '大臣補佐官', '事務次官',
  '官房長官', 'デジタル庁',
  'こども家庭庁', '復興庁',
  '内閣法制局', '法務省',
  '財務省', '文部科学省',
  '厚生労働省', '農林水産省',
  '経済産業省', '国税庁',
  '文化庁', '消防庁',
  '会計検査院', '人事院',
  '公正取引委員会', '個人情報保護委員会',
  '中央労働委員会', '国家公務員倫理審査会',
  '最高検察庁', '次長検事',
  '検事長', '閣議決定',
  '大臣官房', '内閣総理大臣',
  '中央省庁', '特命担当大臣',
];
const negate = [
  'still awaiting the agency review',
  'まだ閣議前', 'これから審査請求',
];
const nullPins = [
  'about to file the agency request',
  'about to join the regulatory board',
];
const establishedPins = [
  // already pinned — kept green
  ['外務省', 'close-tab'],
  ['総務省', 'close-tab'],
  ['消費者庁', 'close-tab'],
  ['まだ認可申請前', 'negate'],
];

describe('pass DCLI: cabinet & ministry administration idioms (salpinx)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
