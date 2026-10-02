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
  // public welfare & livelihood-assistance filing done (生活保護申請の終了側)
  'welfare applied', 'housing support granted',
  'income verified', 'welfare officer visited',
  'support started', 'livelihood protected',
  'benefit granted', 'self support plan made',
];
const closeTabJa = [
  '生活保護', '住宅扶助',
  '収入認定', '資産調査',
  '自立支援計画', '就労支援',
  '介護扶助', '一時扶助',
  '保護費',
];
const negate = [];
const nullPins = [
  'mid review',
];
const establishedPins = [
  ['assessment done', 'close-tab'],
  ['still applying', 'negate'],
  ['福祉窓口に行って', 'go-to'],
  ['まだ手続き中', 'negate'],
  ['これから申請', 'negate'],
];

describe('pass CDLXXXIV: public-welfare filing idioms (koto)', () => {
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
