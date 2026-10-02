/**
 * Voice atoms CCCXXIV — construction completion & handover idioms (EN)
 * + 竣工/完成検査/足場撤去 (JA). Topped out and handed over = close the tab.
 * Groundbreaking, framing, and mid-build stay out.
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
  // --- punch list / walkthrough / inspection ---
  'punch list done', 'punch list closed', 'punch items cleared',
  'snagging done', 'snag list cleared', 'walkthrough done',
  'walkthrough passed', 'final walkthrough done',
  'final inspection passed', 'inspection passed', 'city signed off',
  'inspector signed off', 'building inspector approved',
  'certificate of occupancy', 'occupancy permit issued', 'c of o issued',
  'occupancy granted', 'move in ready',
  // --- handover / ribbon ---
  'keys turned over', 'handover done', 'project handed over',
  'ribbon cut', 'ribbon cutting done', 'ribbon cutting ceremony done',
  'grand opening done', 'building opened', 'doors opened to the public',
  'housewarming done',
  // --- topping out / structure ---
  'topped out', 'topping off done', 'topping out done',
  'last beam placed', 'final beam up', 'roof sealed',
  'watertight', 'dried in', 'dry in done', 'weather tight',
  // --- demobilization ---
  'scaffolding down', 'scaffold came down', 'scaffolding removed',
  'scaffold struck', 'fence came down', 'hoarding down',
  'hoarding removed', 'porta potty gone', 'crane dismantled',
  'crane came down', 'equipment demobilized', 'crew demobilized',
  'workers off site', 'last worker left', 'punch crew gone',
  'site cleared', 'site cleaned', 'debris hauled off',
  'dumpster removed', 'portable toilets gone',
  // --- completion ---
  'project complete', 'construction done', 'construction finished',
  'build finished', 'build complete', 'house finished',
  'home is finished', 'paint dry', 'final coat on',
  'contract closed out', 'retainage paid', 'lien waived',
  'final invoice paid', 'as builts delivered', 'warranty registered',
];

const closeTabJa = [
  // --- 竣工/完成 ---
  '竣工', '竣工しました', '工事完了', '工事が終わって',
  '工事を終えて', '完成しました', '家が完成して', '建物完成',
  '新築完成', '改装完了', 'リフォーム完了', '増築完了',
  // --- 検査/引き渡し ---
  '完成検査', '竣工検査', '検査合格', '完了検査に合格して',
  '最終検査', '役所の検査が終わって', '使用許可が下りて',
  '検査済証が交付されて', '鍵の引き渡し', '施主に引き渡して',
  '引き渡し式', 'お引き渡し', '竣工図書を渡して',
  // --- 撤去/撤収 ---
  '足場を外して', '足場撤去', '足場を解体して',
  '仮囲いを撤去して', '囲いを外して', 'パネルを撤去して',
  'クレーンを解体して', 'クレーンを下ろして', '重機を撤収して',
  '職人が撤収', '作業員が帰って', '現場を畳んで',
  '現場を清めて', '残材を運び出して', '産廃を処理して',
  '仮設トイレを撤去して', '現場事務所を畳んで',
  // --- 式典/披露 ---
  '竣工式', '落成式', '落成', '落成しました',
  '落成披露', 'お披露目', '完成披露', '完成見学会',
  '開所式', '開館式', 'オープンしました',
  '餅まき終了', '上棟式終了', '地鎮祭を終えて',
  // --- 内装仕上げ ---
  'クロス貼り終了', '壁紙を貼り終えて', '塗装終了',
  '塗装が乾いて', '最終コート', '養生を剥がして',
  '床養生を外して', 'クリーニングが終わって', '美装完了',
];

const negate = [
  'keep building', 'stay on the site', 'still under construction',
  'keep the crew working', 'まだ工事中', '工事を続けて',
  '建設を続けて', 'まだ施工中',
];

const nullPins = [
  // groundbreaking / framing / mid-build
  'groundbreaking', 'broke ground', 'foundation poured',
  'framing starts', 'framing underway', 'under construction',
  'work in progress', 'still building', 'walls going up',
  'pouring concrete', '待ち工事', '着工', '着工しました',
  '基礎工事', '基礎工事中', '棟上げ', '建方中',
  '建設中', '施工中', '工事進行中', '上棟', '立柱',
];

const establishedPins = [
  ['keys handed over', 'close-tab'],
  ['引き渡し完了', 'close-tab'],
];

describe('Voice atoms CCCXXIV — construction completion & handover', () => {
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
