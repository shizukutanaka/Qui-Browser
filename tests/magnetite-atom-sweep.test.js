/**
 * Voice atoms CCCXXV — legislative session end & vote idioms (EN)
 * + 国会閉会/解散/採決 (JA). Sine die and the chamber empty = close the tab.
 * Bills in committee, session in progress, and campaigning stay out.
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
  // --- session adjourned ---
  'congress adjourned', 'parliament adjourned', 'senate adjourned',
  'house adjourned', 'session adjourned', 'session ended',
  'session is over', 'session closed', 'session gavelled out',
  'sine die', 'adjourned sine die', 'went sine die',
  'recess called', 'recess declared', 'went into recess',
  'recess began', 'summer recess', 'congressional recess',
  'congress out of session', 'parliament prorogued', 'prorogation done',
  'parliament dissolved', 'dissolved parliament', 'snap election called',
  'session wrapped up', 'legislative session over',
  // --- votes & motions ---
  'bill passed', 'bill is law', 'bill signed into law',
  'law enacted', 'act passed', 'measure passed', 'motion carried',
  'motion passed', 'resolution adopted', 'amendment passed',
  'bill died in committee', 'bill died', 'bill killed',
  'bill defeated', 'motion defeated', 'bill tabled',
  'bill vetoed', 'vetoed', 'veto sustained', 'veto overridden',
  'override succeeded', 'cloture invoked', 'filibuster ended',
  'filibuster broken', 'filibuster stopped', 'talked it out',
  'roll call done', 'roll call vote done', 'voice vote done',
  'quorum lost', 'quorum call done', 'yeas and nays counted',
  'vote count final', 'whip count done', 'reading done',
  'third reading done', 'bill cleared the chamber',
  // --- chamber empties ---
  'chamber emptied', 'floor emptied', 'galleries emptied',
  'cspan went dark', 'congress went home', 'members went home',
  'reporters left the hill', 'aides went home', 'session in the books',
  'journal approved', 'record closed', 'minutes filed',
];

const closeTabJa = [
  // --- 閉会/会期末 ---
  '国会閉会', '国会が閉会して', '閉会しました', '本会議終了',
  '本会議が終わって', '会期末', '会期が終わって', '会期満了',
  '通常国会終了', '臨時国会終了', '特別国会終了', '議会閉会',
  '議会が閉会して', '国会閉幕', '国会が閉幕して', '閉幕しました',
  '議事日程を終えて', '本日の議事終了', '延会', '延会しました',
  '休憩に入って', '国会休会', '夏休みに入って',
  // --- 解散/改選 ---
  '衆院解散', '衆議院解散', '解散しました', '解散総選挙',
  '議会解散', '解散命令', '解散詔書', 'バッジを外して',
  '議席を失って', '改選終了', '任期満了で退任',
  // --- 採決/法案 ---
  '採決終了', '採決が終わって', '採決しました', '投票終了',
  '法案可決', '法案が可決して', '法案が成立して', '法律が成立して',
  '法案成立', '法律成立', '成立しました', '議決しました',
  '賛成多数で可決', '全会一致で可決', '法案否決', '法案が否決されて',
  '廃案になりました', '審議未了で廃案', '継続審議に回して',
  '委員会で否決', '修正案否決', '採決打ち切り', '記名投票終了',
  '起立採決終了', '押しボタン採決終了', '議事録を配布して',
  '議事録が確定して', '署名が終わって', '法案に署名して',
  // --- 議場退出 ---
  '議場を退出して', '議場が空になって', '傍聴席が空いて',
  '議員が帰って', '議員会館に戻って', '議事堂を出て',
  '質疑終了', '質問終了', '答弁終了', '予算審議終了',
];

const negate = [
  'stay in session', 'keep debating', 'keep the filibuster going',
  'still in committee', 'still debating', 'まだ審議中',
  '審議を続けて', '国会を続けて', '議論を続けて',
];

const nullPins = [
  // in progress / campaigning
  'session in progress', 'bill in committee', 'committee hearing',
  'floor debate', 'under debate', 'first reading', 'second reading',
  'floor vote scheduled', 'whip counting', 'cspan live',
  '国会開会', '国会開催中', '審議中', '委員会審議中',
  '質疑中', '採決予定', '国会中継', '本会議中',
  '第一読会', '法案審議中', '国会開会式',
];

const establishedPins = [
  ['gavel fell', 'close-tab'],
];

describe('Voice atoms CCCXXV — legislative session end & vote', () => {
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
