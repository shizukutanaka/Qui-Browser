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
  // business succession & officer-change registration procedures done
  'business transferred', 'succession filed',
  'officer change registered', 'share transfer done',
  'new representative appointed', 'registration complete',
  'articles amended', 'handover finished',
];
const closeTabJa = [
  '事業承継', '役員変更',
  '登記申請', '代表取締役',
  '株式譲渡', '定款変更',
  '承継完了',
  '法務局', '登記完了',
  '商業登記', '会社印',
  '印鑑届',
];
const negate = [
  'still transferring', 'about to transfer',
  'まだ承継中', 'これから承継',
  'まだ登記中',
];
const nullPins = [
  'registration pending', 'mid succession',
];
const establishedPins = [
  ['引き継ぎ完了', 'close-tab'],
];

describe('pass CDXCVII: business succession & officer-change idioms (mukkuri)', () => {
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
