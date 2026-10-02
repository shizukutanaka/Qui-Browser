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
  // school-contactbook & submission errand done (連絡帳・提出物の終了側)
  'form signed', 'lunch money sent',
  'homework signed', 'diary written',
  'contact book filled', 'supply list bought',
  'name tags done', 'uniform marked',
];
const closeTabJa = [
  '連絡帳を書いて', '保護者欄に記入して',
  '担任に連絡して', '学用品を買って',
  '名札を縫って', '上履きに名前を書いて',
  '持ち物に記名して',
];
const negate = [
  'still filling forms', 'about to sign',
  'まだ記入中', 'これから提出する',
];
const nullPins = [
  'mid paperwork', 'school paperwork', 'permission slip',
  '連絡帳', '提出物', '参観日の準備',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['permission slip signed', 'close-tab'],
  ['提出物を出して', 'close-tab'],
  ['プリントに記入して', 'close-tab'],
];

describe('pass CDLVII: school-contactbook idioms (piccolo)', () => {
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
