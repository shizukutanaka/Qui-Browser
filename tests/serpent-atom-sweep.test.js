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
  // listing approved & prospectus filed
  'listing approved', 'prospectus filed',
];
const closeTabJa = [
  '株式市場', '証券取引所',
  '金融先物', 'デリバティブ',
  '投資ファンド', '公社債投信',
  '債券市場',
  '株式公開', 'ipo',
  '上場', '店頭市場',
  '東証', '日経平均',
  '株価', '新規公開',
  '公募増資', '第三者割当',
  '株式分割', '株式併合',
  '株主', '配当',
  '自己株式', '株主優待',
  '株主総会', '単元株',
  '議決権', '大量保有報告',
  '空売り', '信用取引',
  '先物取引', 'オプション取引',
  '決算発表', '有価証券報告書',
  '内部統制報告', '適時開示',
  '証券会社', '投資助言',
  '投資顧問', '資産運用会社',
  '機関投資家', '受託責任',
  'スチュワードシップ',
];
const negate = [
  'still awaiting the listing review',
  'まだ上場前', 'これから公募',
  'まだ決算前', 'これから決算発表',
];
const nullPins = [
  'about to file the securities report',
  'about to attend the shareholders meeting',
  '投資信託', // crumhorn (CDLXXVII) の null ピン維持 — 登録しない
];

describe('pass DCLV: securities-market & listing administration idioms (serpent)', () => {
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
});
