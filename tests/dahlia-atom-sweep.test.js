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
  // paperwork / forms
  'paperwork filed', 'filed the paperwork', 'forms submitted',
  'submitted the forms', 'application filed',
  'filed the application', 'application submitted window',
  'documents stamped', 'stamped the papers', 'notary done',
  // renewals / permits
  'renewed the license', 'id renewed', 'renewed my id',
  'passport renewed', 'renewed the passport',
  'insurance updated', 'updated the insurance',
  'permit obtained', 'got the permit', 'copy issued',
  // bank / counter
  'bank done', 'bank visit done', 'went to the bank',
  'atm done', 'withdrew cash', 'deposited the check',
  'check deposited', 'transfer done',
  'transferred the money', 'wire sent',
  'paid the bill bank', 'bill paid at the counter',
  'counter done', 'window done', 'number called window',
  'ticket called',
  // city hall
  'waited at city hall', 'city hall done',
  'done at city hall', 'ward office done',
  'registered the move', 'moved registered',
  'report filed office',
];
const closeTabJa = [
  '役所終了', '役所を出て', '市役所を出て',
  '区役所を出て', '役場を出て',
  '窓口終了', '窓口を済ませて',
  '手続き終了', '手続きが終わって', '手続きを済ませて',
  '届け出を出して', '届出を済ませて',
  '申請を出して', '申請終了',
  '書類を提出して', '書類を出して',
  '住民票を取って', '印鑑証明を取って', '戸籍を取って',
  '住所変更をして', 'パスポートを取って',
  '保険証をもらって', 'マイナンバーを更新して',
  '印鑑を押して', '捺印して', '認め印を押して',
  '銀行を出て', 'atmを済ませて', 'お金を下ろして',
  '振込をして', '振り込み終了', '送金をして',
  '引き落としを設定して', '口座を作って',
  '通帳を記帳して',
];
const negate = [
  'still at city hall', 'still at the bank',
  'まだ手続き中', 'まだ窓口',
];
const nullPins = [
  'about to file', 'mid paperwork', 'forms', 'documents',
  '手続きの途中', '書類', 'これから役所',
];
const establishedPins = [
  ['license renewed', 'close-tab'],
  ['registration renewed', 'close-tab'],
  ['car registered', 'close-tab'],
  ['seal affixed', 'close-tab'],
  ['転入届を出して', 'close-tab'],
  ['転出届を出して', 'close-tab'],
  ['免許を更新して', 'close-tab'],
  ['免許更新終了', 'close-tab'],
  ['certificate issued', 'security-status'],
  ['got the certificate', 'security-status'],
  ['銀行に行ってきて', 'go-to'],
  ['city hall tomorrow', 'date'],
  ['bank tomorrow', 'date'],
  ['明日役所', 'defer'], ['明日銀行', 'defer'],
];

describe('pass CCCLVII: city hall & bank errand end idioms (dahlia)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
