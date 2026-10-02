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
  // legal-aid grant & counsel retained
  'legal aid granted', 'retainer signed',
];
const closeTabJa = [
  '法律扶助', '民事法律扶助',
  '司法書士費用', '弁護士費用',
  '相談援助', '費用立替',
  '無料相談', '法テラス',
  '法律相談予約', '相談枠',
  '申込審査', '立替金償還',
  '弁護士紹介', '書類作成援助',
  '裁判費用援助', '代理人指定',
];
const negate = [
  'still without counsel',
  'まだ申込前', 'これから審査',
];
const nullPins = [
  'about to retain a lawyer', 'about to hire',
];
const establishedPins = [
  ['これから相談', 'negate'],
  ['まだ申請前', 'negate'],
];

describe('pass DLXI: legal-aid idioms (harmonica)', () => {
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
