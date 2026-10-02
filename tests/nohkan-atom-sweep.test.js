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
  // welfare-commissioner (民生委員/児童委員) assignment idioms
  'commission accepted', 'term completed',
  'diary submitted', 'welfare visit done',
];
const closeTabJa = [
  '民生委員', '児童委員',
  '主任児童委員', '委嘱状',
  '委員証', '巡回訪問',
  '活動報告書', '福祉部会',
  '地区民生委員', '定例ミーティング',
  '委員名簿', '厚生労働大臣委嘱',
  '推薦会', '担当地区',
  'おたより作成', '生活困窮者',
  '独居老人訪問', '虐待通報',
  '民生委員として',
];
const negate = [
  'about to be commissioned',
  'まだ巡回中', 'これから委員活動',
];
const nullPins = [
  'mid patrol round',
];
const establishedPins = [
  ['still on duty', 'negate'],
  ['任期満了', 'close-tab'],
  ['就任式', 'close-tab'],
];

describe('pass DXXVII: welfare-commissioner assignment idioms (nohkan)', () => {
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
