const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

describe('pass DCCVIII: barber & beauty salon licensing (tractor)', () => {
  const closeTab = [
    'barber licensed', 'salon opened', 'beauty parlor certified',
  ];
  const closeTabJa = [
    '理容師法', '美容師法',
    '理容師', '美容師',
    '理容店', '美容室',
    '美容院', '床屋',
    '理髪店', 'ヘアサロン',
    '理美容', '理美容業',
    '理容業', '美容業',
    '理容師免許', '美容師免許',
    '理容師国家試験', '美容師国家試験',
    '理容師会', '美容師会',
    '理容組合', '美容組合',
    '生活衛生同業組合', '保健所長',
    '保健所検査', '衛生管理',
    '消毒', '滅菌',
    '洗髪', '整髪',
    '髭剃り', 'シャンプー',
    'カット', 'パーマ',
    '染髪', 'ヘアカラー',
    '縮毛矯正', 'ヘアセット',
    '着付け', 'メイク',
    'エステ', 'ネイル',
    'まつ毛エクステ', '理美容サロン',
    '理美容器具', '理美容椅子',
    '理容所開設届', '美容所開設届',
    '開設届', '届出済',
    '営業許可証', '理美容料金',
    '予約制', '指名料',
  ];
  const negate = [
    'still awaiting the salon license',
    'still awaiting the barber inspection',
    'まだ施術前', 'これから開店',
  ];
  const nullPins = [
    'about to visit the barber shop',
    'about to file the salon notice',
  ];
  const establishedPins = [
    ['理容所', 'close-tab'], ['美容所', 'close-tab'],
    ['公衆衛生', 'close-tab'], ['保健所', 'close-tab'],
    ['衛生検査', 'close-tab'], ['散髪', 'close-tab'],
    ['顔剃り', 'close-tab'], ['白髪染め', 'close-tab'],
    ['感染症対策', 'close-tab'],
    ['まだ開店前', 'negate'], ['まだ営業中', 'negate'],
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
