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
  // land readjustment procedures done
  'land readjustment approved', 'final plot assigned',
];
const closeTabJa = [
  '区画整理', '換地',
  '仮換地', '清算金',
  '地権者', '土地区画整理事業',
  '事業認可', '縦覧',
  '縦覧期間', '換地計画',
  '換地処分', '保留地',
  '減歩', '減歩率',
  '公共施設', '移転補償',
  '工事費負担', '組合設立',
  '総会決議', '評価額',
  '従前', '従後',
  '換地証明', '登記協力',
];
const negate = [
  'still negotiating the swap', 'about to file objections',
  'これから換地',
];
const nullPins = [
  'mid surveying',
];
const establishedPins = [
  ['settlement paid', 'close-tab'],
  ['仮住まい', 'negate'],
  ['まだ協議中', 'negate'],
];

describe('pass DXXXIV: land readjustment idioms (chappa)', () => {
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
