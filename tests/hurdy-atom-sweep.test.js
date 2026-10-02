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
  // garage registration done & shako-shomei done
  'garage registration done', 'shako-shomei done',
];
const closeTabJa = [
  '車庫証明', '保管場所証明',
  '保管場所', '使用承諾証明',
  '保管場所届出', '車庫届',
  '警察署管轄', '軽自動車届出',
  '申請手数料', '所在図',
  '配置図', '承諾書',
  '標章交付', '車庫代替',
];
const negate = [
  'still waiting on the garage',
  'まだ保管場所前', 'これから車庫証明',
];
const nullPins = [
  'about to apply for the garage spot', 'about to sort out the garage',
];
const establishedPins = [
  ['garage certificate issued', 'security-status'],
  ['まだ届出前', 'negate'],
];

describe('pass DLXXXI: garage-certificate & parking-space idioms (hurdy)', () => {
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
  test.each(establishedPins)('"%s" keeps pin %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
