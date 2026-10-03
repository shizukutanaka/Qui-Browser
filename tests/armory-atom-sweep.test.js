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
  'gun permit renewed', 'firearm license issued',
];
const closeTabJa = [
  // 銃砲法制・所持
  '銃刀法', '銃砲刀剣類',
  '銃砲', '所持許可',
  '拳銃', '散弾銃',
  'ライフル銃', 'けん銃',
  '銃砲所持', '銃砲管理',
  // 銃器部品・店舗
  '実包', '薬莢',
  '弾丸', '銃砲店',
  '銃砲製造', '所持届',
  '納銃', '譲渡届',
  // 射撃
  '射撃', '射撃場',
  '射撃練習', '免状',
  // 火薬類
  '火薬類取締法', '火薬類',
  '火薬庫', '発破',
  '発破技士', '火薬類取扱責任者',
  '工業炸薬', '火工品',
  '爆薬', '炸薬',
  // 煙火
  '煙火', '爆竹',
  '信号煙火', '花火',
  '花火大会', '打ち上げ花火',
  // 刀剣
  '刀剣', '刀剣類',
  '日本刀', '模造刀',
  '登録証',
  // 公安
  '公安審査会', '国家公安委員会',
  '公安', '保安課',
];
const negate = [
  'still awaiting the gun permit',
  'still awaiting the explosives license',
  'まだ持込前', 'まだ所持前',
  'これから所持',
];
const nullPins = [
  'about to visit the gun shop',
  'about to apply for the gun permit',
];
const establishedPins = [
  ['猟銃', 'close-tab'],
  ['空気銃', 'close-tab'],
  ['公安委員会', 'close-tab'],
  ['狩猟登録', 'close-tab'],
  ['狩猟期間', 'close-tab'],
  ['狩猟免状', 'close-tab'],
  ['猟区', 'close-tab'],
  ['まだ登録前', 'negate'],
  ['まだ検査前', 'negate'],
  ['まだ免許前', 'negate'],
];

describe('pass DCXCIII: firearms & explosives regulation (armory)', () => {
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
