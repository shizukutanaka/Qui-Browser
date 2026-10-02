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
  // inheritance renunciation & estate-division agreement done (相続放棄・遺産分割の終了側)
  'inheritance renounced', 'estate divided',
  'heir agreement signed', 'inheritance tax filed',
  'assets appraised', 'deed transferred',
  'notarized will filed', 'limited acceptance',
];
const closeTabJa = [
  '相続放棄', '遺産分割',
  '分割協議', '相続税申告',
  '限定承認', '遺言執行',
  '相続人確定', '遺産目録',
  '相続登記', '特別受益',
];
const negate = [
  'still dividing', 'about to divide',
  'まだ協議中', 'これから協議',
];
const nullPins = [];
const establishedPins = [
  ['probate done', 'close-tab'],
];

describe('pass CDLXXXIX: inheritance & estate-division idioms (taiko)', () => {
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
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
