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
  // birth & homecoming
  'baby born', 'brought baby home',
  'newborn home', 'mom discharged maternity',
  'welcome home baby', 'baby arrived',
  'labor over', 'healthy baby',
  'due date passed',
  // setup & admin
  'car seat installed', 'nursery done',
  'crib assembled', 'bottles sterilized',
  'name registered', 'birth cert filed',
  // events & firsts
  'gender revealed', 'registry closed',
  'first bath done',
];
const closeTabJa = [
  '出産しました', '無事生まれて',
  '母子退院', '赤ちゃんを連れて帰って',
  '新生児を迎えて', 'ベビーシートを取り付けて',
  'ベビールーム完成', '名前を届け出て',
  '出生届を出して', '命名式終了',
  'お七夜終了', '出産祝いをもらって',
  'ベビーシャワー終了', '性別を発表して',
  '初めての沐浴', '沐浴を終えて',
  '陣痛が終わって', '安産でした',
  '母子ともに元気', '予定日が過ぎて',
];
const negate = [
  'still pregnant', 'still in labor',
  'まだ妊娠中', 'まだ陣痛中',
];
const nullPins = [
  'about to give birth', 'mid labor',
  'sonogram', 'baby registry', 'nursery rhymes',
  '出産の途中', 'これから出産',
  '母子手帳', 'エコー写真',
];
const establishedPins = [
  ['baby shower done', 'close-tab'],
  ['baby due tomorrow', 'date'], ['明日予定日', 'defer'],
];

describe('pass CCCLXXX: birth & newborn homecoming end idioms (dogwood)', () => {
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
