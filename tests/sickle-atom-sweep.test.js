const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  'audit opinion issued', 'return filed',
  'assessment issued',
];
const closeTabJa = [
  '会計監査人', '監査基準',
  '監査証拠', '財務諸表',
  '損益計算書', 'キャッシュフロー計算書',
  '連結財務諸表',
  '四半期報告書', '監査報告',
  '監査役監査',
  '会計監査', '法定監査',
  '任意監査',
  '中間監査', '監査等委員会',
  '内部監査',
  'コンプライアンス監査', '税務調査',
  '税務代理',
  '源泉徴収票', '支払調書',
  '印紙税',
  '地方税法', '法人税法',
  '所得税法',
  '相続税法', '租税特別措置法',
  '決算公告',
  '株主総会招集', '計算書類',
  '財務局',
  '財政制度', '財政再建',
  '公債',
  '国債', '税収',
  '交付税',
  '納税', '課税',
];
const negate = [
  'still awaiting the audit report',
  'still awaiting the tax ruling',
  'これから監査',
];
const nullPins = [
  'about to visit the tax bureau',
  'about to file the audit report',
];
const establishedPins = [
  ['fiscal year closed', 'close-tab'],
  ['books audited', 'close-tab'],
  ['ledger closed', 'close-tab'],
  ['会計検査院', 'close-tab'],
  ['貸借対照表', 'close-tab'],
  ['有価証券報告書', 'close-tab'],
  ['内部統制報告', 'close-tab'],
  ['税務署', 'close-tab'],
  ['課税標準', 'close-tab'],
  ['消費税申告', 'close-tab'],
  ['関税定率法', 'close-tab'],
  ['予算執行', 'close-tab'],
  ['決算報告', 'close-tab'],
  ['財務省', 'close-tab'],
  ['一般会計', 'close-tab'],
  ['特別会計', 'close-tab'],
  ['地方交付税', 'close-tab'],
  ['財政支出', 'close-tab'],
  ['歳入歳出', 'close-tab'],
  ['税務相談', 'close-tab'],
  ['まだ監査前', 'negate'],
  ['まだ申告前', 'negate'],
  ['まだ納付中', 'negate'],
];

describe('pass DCCV: accounting, audit & fiscal administration (sickle)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab.map(p => [p]))('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa.map(p => [p]))('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate.map(p => [p]))('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins.map(p => [p]))('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k2]) => [p, k2]))('"%s" stays %s', (p, k2) => {
    expect(key(vc, p)).toBe(k2);
  });
});
