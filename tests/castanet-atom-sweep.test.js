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
  // environmental filing & emissions report done
  'environmental filing accepted', 'emissions report filed',
];
const closeTabJa = [
  '公害係', '環境課',
  '公害苦情', '騒音規制',
  '振動規制', '悪臭対策',
  '環境影響評価', '環境アセスメント',
  '事前協議', '事業所廃水',
  '排出ガス規制', '土壌汚染調査',
  '地盤沈下', '埋立申請',
  '公害防止協定', '環境審議会',
];
const negate = [
  'still under environmental review',
  'まだ調査前', 'これから環境申請',
];
const nullPins = [
  'about to discharge', 'about to emit',
];
const establishedPins = [];

describe('pass DLXIII: environmental-regulation filing idioms (castanet)', () => {
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
