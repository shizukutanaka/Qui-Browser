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
  // passport renewal & ID-photo errand done (証明写真・更新手続きの終了側)
  'photo taken', 'id photo taken',
  'renewal submitted', 'new passport arrived',
  'collected the passport', 'forms filled',
  'fee paid', 'visa applied',
];
const closeTabJa = [
  'パスポートを更新して', '申請して',
  '受け取って', '新しいパスポート',
  '更新手続き',
];
const negate = [
  'still renewing',
  'まだ更新中', 'これから更新する',
];
const nullPins = [
  'mid renewal', 'passport office',
  'パスポートセンター',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['passport renewed', 'close-tab'],
  ['license renewed', 'close-tab'],
  ['証明写真を撮って', 'close-tab'],
  ['手数料を払って', 'close-tab'],
  ['免許を更新して', 'close-tab'],
  ['about to renew', 'negate'],
  ['写真を撮って', 'screenshot'],
];

describe('pass CDLXIV: passport-renewal idioms (fiddle)', () => {
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
