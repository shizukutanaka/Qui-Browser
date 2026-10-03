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
  // digital-governance verbs
  'security audit passed', 'digital portal launched',
];
const closeTabJa = [
  // デジタル政策・法制
  'デジタル社会推進', 'デジタルトランスフォーメーション',
  '政府情報システム', '電子政府',
  'デジタル手続き法', 'オンライン手続き',
  'デジタル庁設置', '電子計算機',
  '情報処理振興',
  // 地域・市民
  'デジタル田園都市', 'デジタルディバイド',
  'デジタルアンバサダー', 'デジタル化',
  // 情報処理・資格
  '情報処理推進機構', 'ipa',
  '基本情報技術者', '応用情報技術者',
  '情報処理安全確保支援士', 'it人材',
  // 情報通信
  '情報通信技術', 'ict',
  '情報システム', 'e-gov',
  // サイバーセキュリティ
  'サイバー基本法', 'サイバーセキュリティ協議会',
  'サイバー攻撃', 'サイバー演習',
  'セキュリティ監査', 'セキュリティパッチ',
  'ゼロデイ', 'ランサムウェア',
  // 情報・個人情報
  '情報漏洩', '脆弱性届出',
  '個人情報流出', '個人情報',
  '情報公開',
];
const negate = [
  'still awaiting the cybersecurity review',
  'まだ監査前', 'まだ対応中',
];
const nullPins = [
  'about to file the incident report',
  'about to visit the digital agency',
];
const establishedPins = [
  ['デジタル庁', 'close-tab'],
  ['個人情報保護法', 'close-tab'],
  ['これから申請', 'negate'],
  ['これから届出', 'negate'],
];

describe('pass DCLXXXVI: digital-government & cybersecurity administration (strait)', () => {
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
