// pass DCCXVIII: travel, transport & driver licensing -> close-tab
// (EN travel/carrier/driver forms + JA 旅行業・貨物運送・旅客運送・運転免許)
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const t1 = { id: 1, url: 'https://a.example', title: 'Tab A', loading: false };
  const t2 = { id: 2, url: 'https://b.example', title: 'Tab B', loading: false };
  const vc = new VoiceCommands({
    speak: () => {},
    onCommand: () => {}
  });
  vc.connectBrowser({
    getActiveTab: () => t1,
    closeTab: () => {},
    tabs: () => [t1, t2]
  });
  return vc;
}

const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

describe('pass DCCXVIII: travel, transport & driver licensing (ophicleide)', () => {
  const closeTab = ['travel agency licensed', 'carrier permit granted', 'driver license issued'];
  const closeTabJa = [
    '旅行業',
    '旅行業法',
    '旅行業者',
    '旅行業登録',
    '第一種旅行業',
    '第二種旅行業',
    '第三種旅行業',
    '地域限定旅行業',
    '旅行業務取扱管理者',
    '総合旅行業務取扱管理者',
    '国内旅行業務取扱管理者',
    '旅行業約款',
    '旅行業保証社',
    '弁済業務保証金',
    '旅行業協会',
    'jata',
    'ツアー企画',
    '企画旅行',
    '受注型企画旅行',
    '募集型企画旅行',
    '手配旅行',
    '添乗員',
    '旅程管理主任者',
    '旅程管理者',
    '観光案内所',
    '着地型観光',
    'ツアーコンダクター',
    '通訳案内士',
    '通訳ガイド',
    '地域通訳案内士',
    '貨物自動車運送事業',
    '貨物自動車運送事業法',
    '一般貨物自動車運送事業',
    '特別積合せ貨物運送',
    '霊柩運送',
    '貨物軽自動車運送事業',
    '軽貨物運送',
    '運送事業者',
    '運送業者',
    '運送業許可',
    '運行管理者',
    '整備管理者',
    '運行管理資格者',
    '緑ナンバー',
    '営業ナンバー',
    '事業用自動車',
    '白ナンバー',
    '自家用自動車',
    '貨物自動車',
    'トラック運送',
    'トラック協会',
    '運転免許',
    '運転免許証',
    '運転免許試験',
    '運転免許試験場',
    '運転免許センター',
    '免許更新',
    '運転免許更新',
    '更新期間',
    '免許証',
    '普通免許',
    '第一種免許',
    '第二種免許',
    '大型免許',
    '中型免許',
    '準中型免許',
    '大型特殊免許',
    '牽引免許',
    'けん引免許',
    '原付免許',
    '二輪免許',
    '大型二輪免許',
    '普通二輪免許',
    '小型二輪免許',
    '仮免許',
    '仮運転免許',
    '技能試験',
    '学科試験',
    '適性検査',
    '視力検査',
    '深視力検査',
    '初心運転者',
    '初心運転期間',
    '初心者マーク',
    'もみじマーク',
    '高齢運転者標識',
    '取得時教育',
    '更新時講習',
    '高齢者講習',
    '特定任意講習',
    '違反者講習',
    '安全運転管理者',
    '副安全教育管理者',
    '安全運転管理',
    '旅客自動車運送事業',
    '旅客自動車運送事業法',
    '一般旅客自動車運送事業',
    '貸切バス事業者',
    '乗合バス事業者',
    'タクシー事業者',
    '特定旅客自動車運送事業',
    '福祉有償運送',
    '自家用有償旅客運送',
    '運転代行業',
    '運転代行業者',
    '代行運転',
    '運転代行認定'
  ];
  const negate = [
    'still awaiting the travel license',
    'still awaiting the transport permit',
    'まだ登録前',
    'まだ更新前',
    'これから開業'
  ];
  const nullPins = ['about to visit the travel bureau', 'about to file the transport permit'];
  const establishedPins = [
    ['質流れ', 'close-tab'],
    ['骨董品', 'close-tab'],
    ['close this tab', 'close-tab'],
    ['keep it', 'negate'],
    ['leave it alone', 'negate']
  ];

  let vc;
  beforeEach(() => {
    vc = makeVC();
  });

  closeTab.forEach((p) => test(`close-tab: "${p}"`, () => expect(key(vc, p)).toBe('close-tab')));
  closeTabJa.forEach((p) => test(`close-tab JA: ${p}`, () => expect(key(vc, p)).toBe('close-tab')));
  negate.forEach((p) => test(`negate: "${p}"`, () => expect(key(vc, p)).toBe('negate')));
  nullPins.forEach((p) => test(`still null: "${p}"`, () => expect(key(vc, p)).toBeNull()));
  establishedPins.forEach(([p, k]) => test(`pin: "${p}" still -> ${k}`, () => expect(key(vc, p)).toBe(k)));
});
