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
  // building-permit application procedures done
  'permit approved', 'blueprint submitted',
  'inspection scheduled', 'occupancy permit granted',
  'contractor hired',
];
const closeTabJa = [
  '建築確認', '確認済証',
  '着工届', '完了届',
  '検査済証', '設計事務所',
  '中間検査', '構造計算',
  '建ぺい率', '容積率',
  '接道',
];
const negate = [
  'still getting the permit', 'about to break ground',
];
const nullPins = [
  'mid permitting', 'permit pending',
  '申請中',
];
const establishedPins = [
  ['まだ審査中', 'negate'],
];

describe('pass DIX: building-permit application idioms (kane)', () => {
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
