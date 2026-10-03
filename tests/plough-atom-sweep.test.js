const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  'hotel licensed', 'inn registered',
  'lodge permit granted',
];
const closeTabJa = [
  '旅館業法', '旅館業',
  '旅館', 'ホテル',
  '民宿',
  '民泊', '簡易宿所',
  'カプセルホテル',
  'ゲストハウス', 'ユースホステル',
  '旅館組合',
  '観光旅館', 'ビジネスホテル',
  'リゾートホテル',
  '旅館業協会', '宿泊施設',
  '客室',
  'フロント', 'チェックイン',
  '宿泊予約',
  '住宅宿泊事業法', '民泊新法',
  '住宅宿泊仲介',
  '住宅宿泊管理業', '旅館営業許可',
  '宿泊者名簿',
  '宿泊約款', '客室稼働率',
  '定員',
  'スイートルーム', 'シングルルーム',
  'ツインルーム',
  '和室', '大浴場',
  '貸切風呂',
  '日帰り入浴', '食事処',
  '宴会場',
  '会議室', '仲居',
  '女将',
  '板長', '調理師',
  '旅館ホテル連合会',
  '全旅連', '旅館審査',
  '施設基準',
  '衛生管理責任者',
];
const negate = [
  'still awaiting the inn license',
  'still awaiting the hotel inspection',
  'まだ宿泊前', 'これから宿泊',
];
const nullPins = [
  'about to visit the inn',
  'about to file the lodging notice',
];
const establishedPins = [
  ['宿泊税', 'close-tab'],
  ['まだ開業前', 'negate'],
  ['まだ入居前', 'negate'],
];

describe('pass DCCVII: hotel & inn licensing (plough)', () => {
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
