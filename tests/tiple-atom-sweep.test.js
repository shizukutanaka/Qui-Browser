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
  // temp agency registered & dispatch contract signed
  'temp agency registered', 'dispatch contract signed',
];
const closeTabJa = [
  '労働者派遣', '派遣契約',
  '派遣先', '派遣元',
  '職業安定法', '職業安定所',
  '有料職業紹介', '無料職業紹介',
  '日雇い', '日雇労働者',
  '請負契約', '派遣期間制限',
  '雇用安定措置', '派遣均等待遇',
  '紹介予定派遣', '登録型派遣',
  '常用型派遣', '労働者供給',
];
const negate = [
  'still on dispatch duty',
  'まだ派遣登録前', 'これから派遣契約',
];
const nullPins = [
  'about to register with the agency', 'about to sign the dispatch contract',
];

describe('pass DXCIII: temp-staffing & labor-dispatch idioms (tiple)', () => {
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
