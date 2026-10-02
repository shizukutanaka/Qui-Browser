/**
 * Voice atoms CCCXVI — prison release & sentence-served idioms (EN)
 * + 釈放/出所/服役終了 (JA). Set free = close the tab.
 * Lockup and ongoing sentence stay out.
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
  // --- released / freed ---
  'walked free', 'walks free', 'set free', 'freed at last',
  'released at last', 'finally released', 'sprung from jail',
  'sprung free', 'bailed out', 'released on bail',
  'out on bail', 'out on parole', 'paroled', 'parole granted',
  'parole board said yes', 'early release', 'released early',
  'out on good behavior', 'sentence commuted', 'commuted',
  'pardon granted', 'presidential pardon', 'full pardon',
  'clemency granted', 'amnesty declared', 'absolved',
  'exonerated', 'fully exonerated', 'conviction overturned',
  'verdict overturned', 'charges dropped', 'charges dismissed',
  'case dismissed', 'acquitted', 'not guilty verdict',
  'found not guilty', 'cleared of all charges', 'name cleared',
  // --- sentence served ---
  'time served', 'sentence served', 'served the sentence',
  'served his time', 'served her time', 'served their time',
  'debt to society paid', 'paid the debt to society',
  'sentence complete', 'sentence over', 'sentence finished',
  'did the time', 'did his time', 'did her time',
  'stretch is over', 'stint is over', 'bid is over',
  'term is up', 'stretch served', 'served the stretch',
  // --- walking out ---
  'gates opened', 'gates opened for it', 'cell emptied',
  'cell door opened', 'walked out the gates', 'out the gate',
  'through the gates', 'beyond the walls', 'outside the walls',
  'free world', 'back in the free world', 'street clothes on',
  'handed back the jumpsuit', 'jumpsuit returned',
  'personal effects returned', 'belongings returned',
  'papers signed', 'release papers signed', 'discharge papers',
  'ankle monitor off', 'monitor removed', 'probation ended',
  'probation over', 'off probation', 'community service done',
];

const closeTabJa = [
  // --- 釈放 ---
  '釈放', '釈放された', '釈放して', '出所', '出所した',
  '仮釈放', '仮釈放された', '刑期満了', '刑期が終わって',
  '保釈', '保釈された', '保釈金を払って', '勾留終了',
  '拘留終了', '留置場を出て', '拘置所を出て', '刑務所を出て',
  '塀の外に出て', '鉄格子を出て', '自由の身になって',
  '自由の身', '娑婆に出て', '世間に戻って', '更生して',
  '社会復帰して', '出所祝い', '恩赦', '恩赦になって',
  '特赦', '減刑', '刑が減って', '執行猶予', '執行猶予がついて',
  // --- 無罪/不起訴 ---
  '無罪放免', '無罪判決', '無罪になった', '無罪が確定して',
  '冤罪が晴れて', '濡れ衣が晴れて', '疑いが晴れて',
  '容疑が晴れて', '嫌疑不十分', '不起訴', '不起訴になった',
  '起訴猶予', '起訴を取り下げて', '告訴を取り下げて',
  '告訴取消', '公訴棄却', '控訴棄却', '逆転無罪',
  '再審無罪', '雪冤', '汚名が晴れて',
  // --- 服役終了 ---
  '服役終了', '刑期を終えて', '罪を償って', '償いを終えて',
  '刑を終えて', '懲役を終えて', '刑務所暮らし終了',
  '房を出て', '独居房を出て', '刑務作業終了',
  '看守が扉を開けて', '面会終了', '差し入れ終了',
  '私物を返して', '所持品を返して', '囚人服を脱いで',
  '保護観察終了', '保護司終了', '社会奉仕終了',
];

const negate = [
  'keep it locked up', 'leave it in jail', 'stay locked up',
  'lock it up and leave it', 'まだ服役中',
];

const nullPins = [
  // lockup / ongoing sentence / arrests
  'locked up', 'sent to jail', 'behind bars', 'doing time',
  'under arrest', 'booked and held', 'life sentence',
  '逮捕', '逮捕された', '収監', '服役中', '拘留中',
  '勾留中', '取り調べ中', '終身刑',
];

const establishedPins = [
  ['lock it up', 'close-tab'],
  ['throw away the key', 'close-tab'],
  ['面会に行く', 'go-to'],
  ['収監したまま', 'describe-tab'],
  ['牢に入れたまま', 'describe-tab'],
];

describe('Voice atoms CCCXVI — prison release & sentence-served idioms', () => {
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
