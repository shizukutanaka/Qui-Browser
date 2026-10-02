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
  // senior-honoring ceremony attended & benefit card issued
  'senior-benefit card issued', 'respect-day party attended',
];
const closeTabJa = [
  '敬老会', '敬老祝賀会',
  '百寿者訪問', '長寿祝い金',
  '米寿祝い', '古希祝い',
  '敬老の日', '敬老バス券',
  '老人クラブ', '老人会員証',
  '入浴券', '福祉パス',
  '敬老祝賀金', '長寿表彰',
  '還暦祝い',
];
const negate = [
  'still not of age',
  'まだ敬老前', 'これから祝賀会',
];
const nullPins = [
  'about to turn ninety', 'about to celebrate',
];
const establishedPins = [];

describe('pass DLXIV: senior-honoring & elder-club idioms (xylophone)', () => {
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
});
