// pass DCCXIX: financial-instruments, payment & crypto licensing -> close-tab
// (EN securities/fund/payment forms + JA 金商法・証券外務員・資金移動・暗号資産)
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

describe('pass DCCXIX: financial-instruments, payment & crypto licensing (vargan)', () => {
  const closeTab = ['securities firm registered', 'fund manager licensed', 'payment handler approved'];
  const closeTabJa = [
    '金融商品取引法',
    '金商法',
    '金融商品取引業',
    '金融商品取引業者',
    '証券会社',
    '証券業',
    '証券取引',
    '証券取引所',
    '取引所取引',
    '店頭取引',
    'pts',
    '株式売買',
    '投資運用業',
    '投資運用業者',
    '投資助言業',
    '投資助言代理業',
    '投資助言業者',
    '第一種金融商品取引業',
    '第二種金融商品取引業',
    '少額電子募集取扱業',
    '登録金融機関',
    '証券外務員',
    '一種外務員',
    '二種外務員',
    '外務員資格',
    '外務員登録',
    '内部管理責任者',
    '投資者保護基金',
    '日本証券業協会',
    '証券アナリスト',
    '認定アナリスト',
    '自主規制',
    '適合性の原則',
    '説明義務',
    '勘定設け勧誘',
    '投資勧誘',
    '有価証券届出書',
    '目論見書',
    '発行市場',
    '流通市場',
    '上場廃止',
    '上場審査',
    '公開買付',
    'tob',
    '大量保有報告',
    '空売り',
    '信用取引',
    '制度信用取引',
    '貸借取引',
    '証券金融会社',
    '日本証券金融',
    '決済機関',
    '証券保管振替機構',
    'ほふり',
    '株券電子化',
    '単元株',
    '株主名簿管理人',
    '証券代行',
    '名義書換',
    '資金移動業',
    '資金移動業者',
    '資金決済',
    '第一種資金移動業者',
    '第二種資金移動業者',
    '第三種資金移動業者',
    '為替取引',
    '送金サービス',
    '電子マネー発行者',
    '電子決済等代行業者',
    '暗号資産',
    '暗号資産交換業',
    '暗号資産交換業者',
    '暗号資産取引',
    '仮想通貨取引所',
    'ステーブルコイン',
    'ウォレット管理',
    'カストディ業務',
    '銀行代理業者',
    '金融サービス仲介業',
    '保険仲立人',
    '少額短期保険業者',
    '少額短期保険業',
    'クレジットカード会社',
    '債権管理回収業',
    '債権回収業者',
    'ファクタリング業',
    'リース業'
  ];
  const negate = [
    'still awaiting the securities license',
    'still awaiting the payment permit',
    'まだ登録前',
    'まだ審査中',
    'これから開業'
  ];
  const nullPins = ['about to visit the securities bureau', 'about to file the payment report'];
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
