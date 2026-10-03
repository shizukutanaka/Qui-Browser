const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

describe('pass DCCIX: entertainment venue licensing (tillage)', () => {
  const closeTab = [
    'theater licensed', 'cinema opened', 'playhouse certified',
  ];
  const closeTabJa = [
    '興行場法', '興行場',
    '興行', '興行師',
    '興行主', '興行者',
    '映画館', '映画劇場',
    'シネマ', 'シネコン',
    'ミニシアター', '劇場',
    '演劇場', '演芸場',
    '寄席演芸場', '芝居小屋',
    '楽屋', '舞台',
    '舞台監督', '舞台装置',
    '舞台照明', '舞台音響',
    '舞台袖', '花道',
    '桟敷', '桟敷席',
    '客席', '座席',
    '指定席', '自由席',
    '立ち見', '立見席',
    '当日券', '前売券',
    'チケット', '興行収入',
    '興行成績', '動員',
    '入場券', '観客動員',
    '満員御礼', 'ロングラン',
    '封切り', '封切館',
    '上映館', '上映時間',
    '上映スケジュール', '番組編成',
    '配給', '配給会社',
    '興行会社', '主催者',
    '企画制作', '制作部',
    '興行界', '演芸',
    '演芸会', '大衆演劇',
    '歌舞伎座', '明治座',
    '宝塚劇場', '四季劇場',
    '帝国劇場', 'ドーム公演',
    'アリーナ公演', 'ホール公演',
    'ツアー公演', '地方公演',
    '公演中止', '公演延期',
    '公演再開', '満席',
    '空席', '定員割れ',
  ];
  const negate = [
    'still awaiting the theater license',
    'still awaiting the venue inspection',
    'まだ公演前', 'まだ開場前',
    'これから開演', 'まだ上演中',
  ];
  const nullPins = [
    'about to visit the playhouse',
    'about to file the venue notice',
  ];
  const establishedPins = [
    ['入場料', 'close-tab'], ['国立劇場', 'close-tab'],
  ];

  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate)('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins)('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins)('"%s" -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
