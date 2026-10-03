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
  // river permit granted & levee inspection passed
  'river permit granted', 'levee inspection passed',
];
const closeTabJa = [
  '河川管理', '一級河川',
  '堤防', '水防',
  '水防団', '流水占用',
  '河川占用', '砂防',
  'ダム管理', '治水',
  '流域', '地下水規制',
  '揚水機場', '排水機場',
  '水路', '渇水',
  '取水制限', '樋門',
  '遊水池',
];
const negate = [
  'still awaiting the water permit',
  'まだ占用前', 'これから占用申請',
];
const nullPins = [
  'about to occupy the riverbed', 'about to apply for the river permit',
];
const establishedPins = [
  ['これから届出', 'negate'],
];

describe('pass DLXXXVII: river-admin & flood-control idioms (zurna)', () => {
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
  test.each(establishedPins)('"%s" keeps pin %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
