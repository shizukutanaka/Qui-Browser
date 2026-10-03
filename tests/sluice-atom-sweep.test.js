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
  // heritage & festival designations
  'heritage registered', 'festival designated',
];
const closeTabJa = [
  // 法制・行政
  '文化基本法', '芸術文化振興',
  '伝統文化', '文化財保護法',
  '古都保存法', '景観法',
  '重要伝統的建造物群', '町並み保存',
  '日本遺産', '地域文化',
  // 指定・保存
  '重要無形文化財', '人間国宝',
  // 伝統芸能・工芸
  '伝統工芸', '伝統芸能',
  '歌舞伎', '能楽',
  '文楽', '邦楽',
  '茶道', '華道',
  '書道', '工芸美術',
  '日本画', '俳句',
  '短歌', '俳諧',
  '落語', '漫才',
  '寄席',
  // 館・劇場
  '国立劇場', '国立博物館',
  '博物館法', '公立博物館',
  '歴史民俗資料館', '国立文楽劇場',
  // 振興機関
  'メディア芸術', '日本芸術文化振興会',
];
const negate = [
  'still awaiting the heritage designation',
  'まだ保護前', 'まだ保存前',
  'まだ保護中',
];
const nullPins = [
  'about to file the cultural report',
  'about to visit the national theatre',
];
const establishedPins = [
  ['文化庁', 'close-tab'],
  ['重要文化財', 'close-tab'],
  ['登録有形文化財', 'close-tab'],
  ['郷土資料館', 'close-tab'],
  ['埋蔵文化財', 'close-tab'],
  ['文化財', 'close-tab'],
  ['史跡', 'close-tab'],
  ['発掘調査', 'close-tab'],
  ['まだ指定前', 'negate'],
  ['これから申請', 'negate'],
  ['まだ登録前', 'negate'],
];

describe('pass DCLXXXIII: cultural heritage & traditional arts administration (sluice)', () => {
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
