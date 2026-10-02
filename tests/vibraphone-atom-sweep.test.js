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
  // school-entry & transfer procedures done
  'enrollment notice received',
];
const closeTabJa = [
  '就学時健康診断', '就学通知',
  '就学援助', '就学指定校',
  '転校手続き', '学区',
  '教育委員会', '転校届',
  '就学届', '通学路',
  '授業料', '新入学児童',
  '教育費無償化', '少人数学級',
  '教科書無償', '給食費',
  '就学費援助', '内申書',
  '通学区域', '学校選択制',
];
const negate = [
  'still waiting for placement',
  'まだ入学前', 'これから転校',
];
const nullPins = [
  'about to graduate',
];
const establishedPins = [
  ['school transfer done', 'close-tab'],
  ['about to transfer', 'negate'],
  ['入学案内', null],
];

describe('pass DLII: school-entry & transfer idioms (vibraphone)', () => {
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
