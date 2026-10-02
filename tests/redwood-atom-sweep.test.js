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
  // filing
  'taxes filed', 'filed my taxes', 'tax return filed',
  'tax return done', 'return submitted', 'efiled', 'e filed',
  'taxes done', 'finished my taxes', 'deductions claimed',
  'refund claimed', 'refund filed', 'refund came',
  'refund arrived', 'refund deposited', 'refund received',
  'paid the taxes', 'taxes paid', 'tax bill paid',
  'estimated taxes paid', 'quarterly taxes done',
  'quarterlies filed', 'extension filed', 'filed an extension',
  'amended return done',
  // forms / accountant
  'w2 in', 'w2s in', '1099 in', '1099s in', 'forms gathered',
  'receipts organized', 'receipts sorted',
  'expense report submitted', 'expenses submitted',
  'expense report filed', 'expenses filed', 'reimbursed',
  'reimbursement came', 'accountant done', 'cpa done',
  'accountant filed it', 'met the accountant',
  'tax meeting done', 'turbotax done', 'software filed',
  // audit / close
  'audit done', 'audit over', 'audit cleared',
  'survived the audit', 'books closed', 'month end close done',
  'quarter end close', 'payroll done', 'payroll ran',
  'invoices sent', 'sent the invoices', 'invoices paid',
  'balanced the books', 'accounts reconciled',
  'bank statement checked', 'statement reconciled',
  'finance review done', 'budget done', 'budget set',
  'budget approved', 'forecast done', 'forecast submitted',
  'books audited', 'fiscal year ended', 'quarter closed',
  'owe nothing',
];
const closeTabJa = [
  // 確定申告
  '確定申告終了', '確定申告が終わって', '確定申告を出して',
  '確定申告した', '申告終了', '申告を済ませて',
  'e-taxで出して', '電子申告して', '還付申告した',
  '還付金が振り込まれて', '還付金が戻って', '控除を申請して',
  '医療費控除', 'ふるさと納税済ませて',
  '年末調整を出して', '源泉徴収票をもらって',
  '源泉徴収を済ませて',
  // 納税/税種
  '納税しました', '税金を払って', '住民税を払って',
  '固定資産税を払って', '自動車税を払って', '消費税申告終了',
  '法人税申告終了', '相続税申告終了', '贈与税申告終了',
  '青色申告終了', '白色申告終了',
  // 税理士/帳簿
  '税理士に依頼して', '税理士に任せて', '税務署に出して',
  '帳簿をつけて', '会計ソフトに入れて', '仕訳を終えて',
  '仕訳終了', '月次決算終了', '四半期決算終了',
  '決算が終わって', '決算処理完了', '締め処理終了',
  '締め作業終了',
  // 経費/請求/入金
  '経費精算終了', '経費申請を出して', '経費を申請して',
  '領収書を整理して', '領収書をまとめて', '請求書を出して',
  '請求書を送って', '入金確認して', '入金を確認して',
  '給与計算終了', '振込を済ませて', '帳簿合わせて',
  '残高を確認して', '残高が合って', '試算表を作って',
  '財務諸表を作って',
  // 監査/年度末
  '監査終了', '監査が終わって', '税務調査が終わって',
  '調査が済んで', '年度末処理終了', '期末処理終了',
];
const negate = [
  'still filing', 'still doing taxes', 'keep working on taxes',
  'まだ申告中', 'まだ確定申告中', '申告を続けて',
];
const nullPins = [
  'taxes due', 'taxes due soon', 'in the middle of taxes',
  'audit ongoing', 'mid audit', 'waiting on the accountant',
  'refund pending', 'refund expected',
  '申告期限', '期限が迫って', '会計処理中', '経理中',
  '税理士と打ち合わせ中',
];
const establishedPins = [
  ['books reconciled', 'close-tab'], ['year end close', 'close-tab'],
  ['close the books', 'close-tab'], ['books balanced', 'close-tab'],
  ['ledger balanced', 'close-tab'], ['fiscal year closed', 'close-tab'],
  ['年末調整終了', 'close-tab'], ['決算終了', 'close-tab'],
  ['売上を締めて', 'close-tab'],
  ['エクスポートして', 'download'], ['税務署に行って', 'go-to'],
  ['taxes tomorrow', 'date'], ['明日確定申告', 'defer'],
];

describe('pass CCCXL: tax filing/accounting/bookkeeping end idioms (redwood)', () => {
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
