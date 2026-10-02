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
  // parents' tech-help errand done (実家のPC/スマホ代行の終了側)
  'phone set up', 'tablet configured',
  'printer connected', 'passwords written down',
  'apps installed', 'font enlarged',
  'account created',
];
const closeTabJa = [
  'スマホを設定して', 'タブレットを設定して',
  'パスワードをメモして', 'アプリを入れて',
  'プリンタを繋いで', '契約を変えて',
  '親のパソコンを直して',
];
const negate = [
  'about to configure', 'これから設定する',
];
const nullPins = [
  'mid setup', 'tech support', 'parents laptop',
  '実家のパソコン', '設定中', 'スマホ設定',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['wifi fixed', 'online-status'],
  ['sim swapped', 'close-tab'],
  ['文字を大きくして', 'reader-size-up'],
  ['wifiを直して', 'online-status'],
  ['still setting up', 'negate'],
  ['まだ設定中', 'negate'],
];

describe('pass CDLX: parents-tech-help idioms (trombone)', () => {
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
