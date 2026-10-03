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
  // factory site approved & downtown grant issued
  'factory site approved', 'downtown grant issued',
];
const closeTabJa = [
  '工業団地', '企業誘致',
  '立地補助金', '工場立地法',
  '緑地面積', '地域経済牽引',
  '産業振興', '商店街振興',
  'まちづくり会社', '中心市街地活性化',
  '認定商店街', '空き店舗',
  '商店街連合会', 'アーケード商店街',
  '商店会', '個店支援',
  '大型店出店', '大店立地法',
  '中小企業振興', '地域資源活用',
  '特産品開発', '道の駅認定',
  '産業祭', '創業支援',
  '事業継続補助',
];
const negate = [
  'still awaiting the site decision',
  'まだ出店前', 'これから出店',
];
const nullPins = [
  'about to apply for the relocation grant',
  'about to open the storefront',
];
const establishedPins = [
  ['ふるさと名物', 'close-tab'],
  ['地域ブランド', 'close-tab'],
  ['創業塾', 'close-tab'],
];

describe('pass DCXIX: industrial-siting & shopping-street revitalization (bonang)', () => {
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
  test.each(establishedPins)('pinned "%s" stays "%s"', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
