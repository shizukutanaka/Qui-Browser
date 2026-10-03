const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  'channel marked', 'lighthouse restored',
];
const closeTabJa = [
  '海難審判庁', '海難事故',
  '海事審判',
  '船員職業安定所', '船員保険',
  '船員登録', '船員手帳',
  '水先区', '水先案内人',
  '船舶職員法',
  '海上労働', '船員組合',
  '沿航海',
  '定期航路', '海上運送',
  '旅客船',
  '貨客船', 'タグボート',
  '海洋掘削', '浚渫',
  '埋立',
  '航路', '航路開発',
  '浮標',
  '海上衝突予防法', '港則法',
  '特定航路', '航路指定',
  '船舶往来',
  '海上交通センター', '船舶自動識別装置',
  '海図',
  '水路情報', '水路協会',
  '航法', '針路',
  '航海計器',
];
const negate = [
  'still awaiting the sea trial',
  'still awaiting the fairway survey',
  'まだ通航前', 'これから入港',
  'まだ就航中', 'まだ航海中',
];
const nullPins = [
  'about to visit the maritime bureau',
  'about to file the sea report',
];
const establishedPins = [
  ['海難審判', 'close-tab'],
  ['海難', 'close-tab'],
  ['船員法', 'close-tab'],
  ['水先人', 'close-tab'],
  ['船舶職員', 'close-tab'],
  ['外航', 'close-tab'],
  ['内航', 'close-tab'],
  ['船舶運航', 'close-tab'],
  ['フェリー', 'close-tab'],
  ['航路標識', 'close-tab'],
  ['灯台', 'close-tab'],
  ['海上交通安全法', 'close-tab'],
  ['水路測量', 'close-tab'],
  ['まだ入港前', 'negate'],
];

describe('pass DCCI: maritime traffic & navigational safety (tuner)', () => {
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
