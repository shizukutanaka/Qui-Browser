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
  // landline & utility contract changes done (固定電話・ライフライン契約変更の終了側)
  'landline cancelled', 'gas shut off',
  'meter read', 'contract switched',
  'power connected', 'billing name changed',
];
const closeTabJa = [
  '固定電話を解約して', 'ガスを止めて',
  'メーターを読んで', '名義を変えて',
  '電話を止めて', '契約者を変更して',
];
const negate = [
  'still switching',
  'これから解約',
];
const nullPins = [
  'mid transfer', 'utility company',
  '電力会社', 'プロパンガス',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['utilities transferred', 'close-tab'],
  ['電気を止めて', 'close-tab'],
  ['まだ手続き中', 'negate'],
  ['水道を開けて', 'go-to'],
  // about to switch collides with zonka (CDXXXIX)'s null pin — documented, not added
  ['about to switch', null],
];

describe('pass CDLXXI: landline & utility-contract idioms (zither)', () => {
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
