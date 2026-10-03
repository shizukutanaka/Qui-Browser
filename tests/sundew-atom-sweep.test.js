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
  'factory permit granted', 'industrial subsidy approved',
];
const closeTabJa = [
  // 政策・法制
  '産業政策', '産業競争力',
  '産業競争力強化法', '経済産業局',
  '産業構造審議会', '産業労働局',
  // ものづくり・技術
  '製造業', 'ものづくり振興',
  '基礎技術研究支援', '産業技術',
  'ものづくり白書', '試作開発',
  '試作支援',
  // 経済安保・供給
  '経済安全保障', '経済安保',
  'サプライチェーン', '重要物資',
  '安定供給', '原材料調達',
  'レアメタル', '原材料費',
  // 業種
  '半導体', '半導体産業',
  '化学産業', '鉄鋼業',
  '工作機械', '情報製造サービス',
  '中核産業', '伝統的工芸品産業',
  // 輸出・投資・展示
  'プラント輸出', '輸出振興',
  '国内投資促進', '海外展開',
  '投資促進', '展示会出展',
  // 下請・団体
  '下請法', '下請代金法',
  '下請取引', '経済団体',
];
const negate = [
  'still awaiting the industry review',
  'まだ交付前', 'これから補助申請',
  'まだ受付中', 'まだ開催前',
];
const nullPins = [
  'about to file the manufacturing report',
  'about to visit the trade bureau',
];
const establishedPins = [
  ['経済産業省', 'close-tab'],
  ['産業振興', 'close-tab'],
];

describe('pass DCLXXXVII: industry & manufacturing administration (sundew)', () => {
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
