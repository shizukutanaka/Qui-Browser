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
  // permanent-residency & naturalization application procedures done
  'permanent residency granted', 'naturalization approved',
  'visa renewed', 'residence card issued',
  'immigration appointment done', 'certificate of eligibility',
  'reentry permit stamped', 'status changed',
];
const closeTabJa = [
  '永住権', '永住許可',
  '帰化', '帰化申請',
  '在留資格', '在留カード',
  'ビザ更新', '資格変更',
  '入国管理局', '入管局',
  '認定証明書', '再入国許可',
];
const nullPins = [
  'about to apply', 'mid screening',
];
const establishedPins = [
  ['still applying', 'negate'],
  ['まだ申請中', 'negate'],
  ['これから申請', 'negate'],
  ['まだ審査中', 'negate'],
  ['application pending', null],
];

describe('pass CDXCIV: permanent-residency & naturalization idioms (gagaku)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa)('"%s" -> close-tab (ja)', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(nullPins)('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
