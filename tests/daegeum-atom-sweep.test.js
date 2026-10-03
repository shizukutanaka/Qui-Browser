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
  // absentee ballot cast & candidate filing accepted
  'absentee ballot cast', 'candidate filing accepted',
];
const closeTabJa = [
  '選挙管理委員会', '期日前投票所',
  '当日投票', '不在者投票所',
  '在外投票', '比例代表',
  '小選挙区', '開票所',
  '投票所', '選挙公報',
  '選挙運動', '立候補届',
  '選挙費用', '政治資金',
  '収支報告書', '公費負担',
  '選挙啓発', '選挙人名簿',
  '投票入場券', '投票管理者',
  '開票管理者', '選挙監視員',
  '立会人', '政見放送',
  'ポスター掲示',
];
const negate = [
  'still awaiting the filing',
  'まだ立候補前', 'これから立候補届',
];
const nullPins = [
  'about to file for candidacy', 'about to cast the early ballot',
  // eudialyte null pins — kept unregistered, 期日前投票所/不在者投票所 registered instead
  '期日前投票', '不在者投票',
];

describe('pass DCVIII: election administration idioms (daegeum)', () => {
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
