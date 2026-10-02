/**
 * Voice atoms CCCXVIII — military stand-down & demobilization idioms (EN)
 * + 武装解除/衛兵交代/点呼終了 (JA). Duty over = close the tab.
 * Bare 'at ease' stays null; compound 'at ease close it' already close-tab.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  const tabs = [{ id: 1, url: 'https://a.example', title: 'A' }];
  vc.connectBrowser({
    getActiveTab: () => tabs[0],
    closeTab: () => {},
    tabs: () => tabs,
  });
  return vc;
}

function key(vc, phrase) {
  const r = vc._matchCommand(phrase);
  return r && r.key;
}

const closeTab = [
  // --- dismissed / stand down ---
  'dismissed', 'unit dismissed', 'company dismissed',
  'platoon dismissed', 'squad dismissed', 'troops dismissed',
  'fall out', 'fell out', 'broke ranks', 'ranks broken',
  'stand easy', 'parade dismissed', 'formation dissolved',
  'held the last formation', 'final formation done',
  'mustered out', 'muster out', 'muster roll closed',
  // --- demobilized / discharged ---
  'demobilized', 'demobilization done', 'honorably discharged',
  'general discharge', 'service ended', 'tour of duty over',
  'tour ended', 'deployment over', 'deployment ended',
  'rotated home', 'rotated back', 'came home from deployment',
  'returned from the front', 'back from the front lines',
  'separated from service', 'service complete', 'active duty over',
  'went to the reserves', 'transferred to the reserves',
  'dd214 in hand', 'papers processed', 'out processed',
  'discharge processed', 'uniform turned in', 'uniform hung up',
  'boots hung up', 'dog tags retired', 'came home a civilian',
  // --- weapon/equipment stand-down ---
  'weapons down', 'weapons secured', 'arms stacked',
  'stack arms', 'rifles racked', 'rifles secured',
  'weapon unloaded', 'magazines emptied', 'ammo turned in',
  'safety on', 'sling your rifle', 'holstered the sidearm',
  'gear turned in', 'kit inspected', 'issued gear returned',
  'body armor off', 'helmet off', 'rucksack dropped',
  'pack stowed', 'footlocker locked',
  // --- base/flag/watch end ---
  'colors retired', 'flag lowered', 'flag folded',
  'taps played out', 'retreat sounded', 'evening colors done',
  'watch ended', 'watch relieved', 'guard changed',
  'relief arrived', 'post secured', 'post stood down',
  'patrol over', 'patrol returned', 'checkpoint closed',
  'perimeter secured for the night', 'base locked down',
  'barracks emptied', 'bunks made', 'bunks stripped',
  'barracks lights out', 'quarters emptied', 'tent struck',
  'foxhole abandoned', 'position abandoned', 'fob closed',
  'outpost shuttered', 'camp torn down', 'convoy arrived',
  'trucks parked', 'hangar doors closed', 'runway quiet',
  // --- mission end ---
  'mission accomplished', 'mission over', 'operation over',
  'objective complete', 'objective secured', 'area secured',
  'all objectives met', 'rtb', 'returned to base',
  'extraction complete', 'exfil done', 'dustoff complete',
  'last bird lifted off', 'wheels up for home',
];

const closeTabJa = [
  // --- 解散/除隊 ---
  '除隊', '除隊した', '退役', '退役した', '退役処理',
  '除籍', '軍務終了', '兵役終了', '任期満了で退隊',
  '予備役に移って', '予備役編入', '現役を退いて',
  '制服を脱いで', '軍服を畳んで', '軍靴を脱いで',
  '認識票を外して', 'ドッグタグを外して', '退役証明',
  // --- 武装解除 ---
  '武装解除', '武装を解除して', '武器を降ろして',
  '武器を納めて', '銃を下ろして', '弾を抜いて',
  '弾倉を外して', '安全装置をかけて', '小銃をしまって',
  '武器庫に戻して', '支給品を返却して', '装備を返納して',
  'ヘルメットを脱いで', '背嚢を下ろして', 'リュックを置いて',
  // --- 衛兵/国旗/点呼 ---
  '衛兵交代', '衛兵が交代して', '見張り交代', '歩哨交代',
  '当直交代', '監視終了', '哨戒終了', '巡回終了',
  '国旗降納', '国旗を降ろして', '国旗畳み', '軍旗を畳んで',
  '夕喇叭', 'ラッパが鳴り終わって', '点呼終了',
  '朝点呼終了', '夕点呼終了', '最後の点呼',
  '営舎を出て', '営内を出て', '寮を出て', '兵舎を出て',
  '駐屯地を出て', '基地を出て', '陣地を畳んで',
  '掩体を捨てて', '塹壕を出て', '警戒網を解いて',
  '検問所を閉じて', '警備を解いて', '封鎖を解いて',
  // --- 任務終了 ---
  '任務完了', '任務を終えて', '作戦終了', '作戦を終えて',
  '目標達成', '全目標達成', '撤収完了', '撤収して',
  '撤収命令', '帰投', '帰投して', '基地に帰投',
  '救出完了', '輸送完了', '最後の便が飛び立って',
];

const negate = [
  'stay on watch', 'keep the post', 'stay on duty',
  'remain at your post', 'keep it on patrol', 'まだ任務中',
  '哨戒を続けて', '警備を続けて',
];

const nullPins = [
  // active duty / ongoing ops
  'on duty', 'on patrol', 'standing watch', 'still deployed',
  'active duty', 'under orders', 'at ease', 'attention',
  '服役中', '任務中', '哨戒中', '出撃中', '駐留中',
  '配備中', '召集された', '徴兵された', '入隊',
];

const establishedPins = [
  ['stand down', 'negate'],
  ['decommissioned', 'close-tab'],
  ['mission complete', 'close-tab'],
  ['stand down close it', 'close-tab'],
  ['at ease close it', 'close-tab'],
  ['退役させて', 'close-tab'],
  ['除隊させて', 'close-tab'],
];

describe('Voice atoms CCCXVIII — military stand-down & demobilization', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
  test.each(nullPins.map((p) => [p]))('"%s" -> null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k) => {
    expect(key(makeVC(), p)).toBe(k);
  });
});
