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
  // contractor visit done
  'repairman left', 'repair done home',
  'electrician left', 'plumber left',
  'locksmith done', 'exterminator done',
  'pest control done',
  // appliance/plumbing fixed
  'leak fixed', 'pipe fixed',
  'ac repaired', 'furnace fixed',
  'washer fixed', 'fridge fixed',
  'dishwasher repaired', 'oven fixed',
  'water heater fixed', 'hot water back',
  // power & misc
  'power back on', 'key made',
  'lock rekeyed', 'elevator fixed',
  'generator serviced',
];
const closeTabJa = [
  '業者が帰って', '水漏れを直して',
  '水道を直して', '洗濯機を直して',
  '冷蔵庫を直して', '食洗機を直して',
  '給湯器を直して', 'お湯が出るようになって',
  '電気が復旧して', '電気屋さんが帰って',
  '水道屋さんが帰って', '鍵屋が帰って',
  '合鍵を作って', '鍵を交換して',
  '害虫駆除終了', '点検が終わって',
  'エレベーターが直って', 'ガス点検終了',
];
const negate = [
  'still leaking',
  'まだ故障中', 'まだ水漏れ中',
];
const nullPins = [
  'about to call the plumber', 'mid repair',
  'warranty card', 'repair estimate', 'fuse box',
  '修理の途中', 'これから修理',
  '保証書', '見積もり',
];
const establishedPins = [
  ['修理が終わって', 'close-tab'], ['エアコンを直して', 'close-tab'],
  ['still broken', 'trouble'],
  ['repair scheduled tomorrow', 'date'], ['明日修理', 'defer'],
];

describe('pass CCCLXXXIII: home-repair & contractor visit end idioms (hawthorn)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
