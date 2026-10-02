/**
 * Voice atoms CCCXVII — hospital discharge & recovery idioms (EN)
 * + 退院/全快/抜糸 (JA). Cleared to go home = close the tab.
 * Admission, ongoing treatment, and relapse stay out.
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
  // --- discharge ---
  'discharged', 'discharged today', 'finally discharged',
  'released from the hospital', 'hospital released it',
  'cleared to go home', 'cleared for discharge', 'going home today',
  'sent home', 'sent home at last', 'checked out of the hospital',
  'signed out ama', 'out of the ward', 'ward emptied',
  'walking out of the ward', 'left the hospital', 'out of the hospital',
  'hospital stay over', 'stay in the hospital is over',
  'bill settled', 'medical bill paid', 'discharge papers signed',
  'discharge summary done', 'home care arranged', 'follow up scheduled',
  // --- recovery ---
  'recovered', 'fully recovered', 'back on its feet',
  'good as new', 'better than ever', 'all healed up',
  'healed completely', 'clean bill of health', 'all clear',
  'doctor gave the all clear', 'test results came back clean',
  'cancer free', 'remission achieved', 'in remission',
  'cured', 'completely cured', 'made a full recovery',
  'turned the corner', 'out of the woods', 'over the worst of it',
  'fever broke', 'swelling went down', 'pain is gone',
  // --- medical teardown ---
  'cast off', 'cast came off', 'stitches out', 'staples out',
  'sutures removed', 'bandages off', 'dressing removed',
  'iv removed', 'iv came out', 'off the drip', 'tubes removed',
  'catheter out', 'drain pulled', 'monitors unhooked',
  'off the monitors', 'ventilator removed', 'extubated',
  'oxygen off', 'crutches down', 'off crutches', 'brace off',
  'sling off', 'walker retired', 'wheelchair parked',
  'gown came off', 'wristband cut off', 'wristband off',
  // --- therapy done ---
  'physical therapy done', 'pt finished', 'rehab complete',
  'last chemo session', 'chemo done', 'radiation done',
  'last dose taken', 'course of antibiotics done',
  'prescription finished', 'meds done', 'final checkup done',
  'cleared for work', 'fit for duty',
];

const closeTabJa = [
  // --- 退院 ---
  '退院', '退院した', '退院許可', '退院が許されて', '退院日',
  '今日退院', '病院を出て', '病室を出て', '病棟を出て',
  '入院生活終了', '入院が終わって', '医師が退院を認めて',
  '退院手続き完了', '退院の許可が出て', '入院費を精算して',
  '看護師に見送られて', '自宅療養に切り替えて', '外来に移って',
  // --- 全快 ---
  '完治', '完治した', '全快', '全快した', '快気', '快気祝い',
  '治癒', '治りきって', 'すっかり治って', 'すっかり良くなって',
  '回復して', '元気を取り戻して', '元通りになって',
  '峠を越えて', '峠は越した', '熱が下がって', '腫れが引いて',
  '痛みが消えて', '検査結果が良好で', '寛解', '寛解期に入って',
  // --- 医療撤去 ---
  '抜糸', '抜糸した', 'ステープラーを外して', 'ギプスを外して',
  'ギプスが取れて', '包帯を取って', 'ガーゼを取って',
  '点滴を外して', '点滴が外れて', 'チューブを外して',
  'カテーテルを外して', 'ドレーンを抜いて', 'モニターを外して',
  '酸素吸入終了', '松葉杖を卒業して', '車椅子を卒業して',
  'コルセットを外して', 'ギプス卒業', 'リストバンドを外して',
  '入院着を脱いで', 'リハビリ終了', '化学療法終了',
  '抗がん剤終了', '最後の服薬', '薬を飲み切って',
  '経過観察終了', '通院終了',
];

const negate = [
  'keep it in the hospital', 'stay hospitalized', 'keep it on the drip',
  'leave the iv in', 'まだ入院中',
];

const nullPins = [
  // admission / ongoing treatment / relapse
  'admitted', 'admitted to the hospital', 'checking into the hospital',
  'in the hospital', 'hospitalized', 'under observation',
  'still recovering', 'on bed rest', 'in the icu', 'post op',
  'surgery scheduled', 'relapsed',
  '入院', '入院した', '入院中', '入院予定', '検査入院',
  '手術予定', '手術前', '術後', '療養中', '通院中',
  '再発', '悪化', '回診中',
];

const establishedPins = [
  ['病院に行く', 'go-to'],
  ['leave it be', 'negate'],
  ['入院したまま', 'describe-tab'],
  ['operation tomorrow', 'date'],
];

describe('Voice atoms CCCXVII — hospital discharge & recovery idioms', () => {
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
