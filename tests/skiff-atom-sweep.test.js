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
  // bar exam & license sworn
  'bar exam passed', 'license sworn in',
];
const closeTabJa = [
  // 弁護士系
  '弁護士', '弁護士会',
  '日本弁護士連合会', '日弁連',
  '弁護士法', '予備試験',
  '修習生', '裁判官',
  '法律事務所',
  // 弁理・税理・会計
  '弁理士', '弁理士会',
  '税理士', '税理士会',
  '公認会計士', '会計士協会',
  '監査法人',
  // 技術・工事
  '技術士', '技術士会',
  '危険物取扱者', '消防設備士',
  '危険物取扱責任者', '労働安全コンサルタント',
  '機械設計技術者', '建築設備士',
  '造園技能士', '技能検定',
  '技能五輪',
];
const negate = [
  'still awaiting the bar exam',
  'まだ試験前', 'これから入会',
  'まだ試験中',
];
const nullPins = [
  'about to file the license application',
  'about to join the bar association',
];
const establishedPins = [
  ['司法試験', 'close-tab'],
  ['司法修習', 'close-tab'],
  ['検事', 'close-tab'],
  ['判事', 'close-tab'],
  ['電気主任技術者', 'close-tab'],
  ['電気工事士', 'close-tab'],
  ['衛生管理者', 'close-tab'],
  ['安全管理者', 'close-tab'],
  ['通関士', 'close-tab'],
  ['司法書士', 'close-tab'],
  ['土地家屋調査士', 'close-tab'],
  ['海事代理士', 'close-tab'],
  ['行政書士', 'close-tab'],
  ['社会保険労務士', 'close-tab'],
  ['これから受験', 'negate'],
  ['まだ登録前', 'negate'],
  ['まだ入会前', 'negate'],
  ['まだ申請中', 'negate'],
  ['これから申請', 'negate'],
];

describe('pass DCLXXX: legal & certified professions (skiff)', () => {
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
