const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  'slot approved', 'gate reassigned',
];
const closeTabJa = [
  '航空会社', '航空輸送',
  '国際航空', '国内航空',
  'エアライン', '国際線',
  '国内線',
  '航空事業', '航空機',
  '機長', '副操縦士',
  '客室乗務員', '整備士',
  '一等航空整備士', '航空管制',
  '航空保安',
  '航空路', '航空路監視',
  '航空法施行規則', '航空貨物',
  '空港設置',
  '空港管理', '滑走路',
  '誘導路', '駐機場',
  'エプロン',
  'ターミナルビル', '空港利用料',
  '着陸料', '空港周辺対策',
  '騒音対策',
  '空港周辺整備', '航空機騒音',
  '制限表面', '移転円滑化',
  '空港用地',
  '空港ターミナル', '地方空港',
  '空港機能強化', '航空輸入',
  '航空輸出',
  '航空連合', '航空乗継',
  '運航乗務員', '航空保安官',
  '管制官',
  '航空管制官', '航空管制部',
  'フライト',
];
const negate = [
  'still awaiting the slot ruling',
  'まだ搭乗前', 'まだ到着前',
  'これから出発', 'まだ着陸前',
];
const nullPins = [
  'about to visit the airport office',
  'about to file the flight plan',
];
const establishedPins = [
  ['still awaiting the airworthiness review', 'negate'],
  ['定期航空', 'close-tab'],
  ['航空保安施設', 'close-tab'],
  ['航空運送事業', 'close-tab'],
  ['運航管理者', 'close-tab'],
  ['まだ整備中', 'negate'],
];

describe('pass DCCII: air transport & airport operations (antenna)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab.map(p => [p]))('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa.map(p => [p]))('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate.map(p => [p]))('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins.map(p => [p]))('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k2]) => [p, k2]))('"%s" stays %s', (p, k2) => {
    expect(key(vc, p)).toBe(k2);
  });
});
