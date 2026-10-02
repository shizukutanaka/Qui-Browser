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

const closeTabJa = [
  '住民票の写し', '住民票コード',
  '印鑑証明', '印鑑登録証',
  '廃印届', '紛失届',
  'コンビニ交付', '交付申請',
  '除票', '改製原戸籍',
  '附票', '本籍地',
  '転籍届', '住基ネット',
  '戸籍届出', '受理証明書',
  '身分証明書',
];
const negate = [
  'まだ申請前', 'これから請求',
  'まだ取得中',
];
const nullPins = [
  'about to request',
];
const establishedPins = [
  ['certificate reissued', 'security-status'],
  ['seal registered', 'close-tab'],
  ['still at city hall', 'negate'],
  ['戸籍謄本', 'close-tab'],
  ['戸籍抄本', 'close-tab'],
  ['印鑑登録', 'close-tab'],
];

describe('pass DXLIV: certificate & seal-registry idioms (organ)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

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
