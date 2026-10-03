// pass DCCXXXII: fisheries, aquaculture & marine-trade domain -> close-tab
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

describe('pass DCCXXXII: fisheries & marine trades (sasara)', () => {
  const closeTab = ['deckhand licensed', 'fishery officer certified', 'harbor pilot registered'];
  const closeTabJa = [
    '水産技士',
    '水産技術士',
    '水産業務取扱主任者',
    '漁業士',
    '漁業経営士',
    '漁業経営アドバイザー',
    '漁業指導員',
    '漁業改良普及員',
    '水産普及指導員',
    '水産食品技士',
    '水産食品加工',
    '水産品評価員',
    '魚食普及',
    '魚食推進',
    '魚料理インストラクター',
    '釣りインストラクター',
    '釣具販売士',
    '釣り師',
    '釣りビジネスアドバイザー',
    '船舶機関士',
    '船内荷役作業主任者',
    '小型船舶操縦士',
    '小型船舶免許',
    '特殊小型船舶操縦士',
    '水上バイク免許',
    '救命講習',
    '救命胴衣着用',
    '水難救助員',
    '潜水士',
    '潜水作業者',
    'レジャー潜水士',
    'スキューバダイビング指導員',
    '水中作業員',
    '船舶保守士',
    '船舶整備士',
    '船舶電気士',
    '船舶塗装士',
    '造船技士',
    '船舶検査機構',
    '日本小型船舶検査機構',
    '海技試験',
    '海技従事者',
    '海技免状試験',
    '海技審査会',
    '船員福祉士',
    '船舶管理者',
    '船舶管理業',
    '船舶運航管理者',
    '海運代理店',
    '船舶仲介業',
    '海運ブローカー',
    '港湾運送事業',
    '港湾労務管理者',
    '港湾荷役作業主任者',
    '港湾設備技士',
    '港湾整備士',
    '漁港管理者',
    '漁港漁場整備士',
    '漁場整備士',
    '水産基盤整備士',
    '栽培漁業技士',
    '養殖業管理者',
    '養殖技士',
    '養殖生産管理士',
    '水面養殖士',
    '種苗生産士',
    '種苗放流士',
    '増養殖管理士',
    '水産養殖',
    '海苔養殖',
    '真珠養殖',
    '真珠加工士',
    '真珠鑑定士',
    '真珠核入れ技士',
    '真珠養殖士',
    '海藻養殖士',
    '昆布養殖士',
    'わかめ養殖士',
    'あわび養殖士',
    '牡蠣養殖士',
    '真珠母貝管理士',
    '漁具製作士',
    '漁具管理士',
    '網漁具士',
    '釣り針製作士',
    '養殖網管理士',
    '漁船設計士',
    '漁船改造士',
    '漁船検査士',
    '漁船登録',
    '漁船籍',
    '漁船保険',
    '漁業保険',
    '漁業共済組合',
    '漁船保険組合',
    '水産物保険',
    '海運保険',
    '船舶保険',
    '貨物保険',
    '船荷証券',
    '海運貨物取扱業',
    '海運貨物仲介',
    '海運税関手続',
    '海運輸入業',
    '海運輸出業',
    '外航海運',
    '内航海運',
    '近海海運',
    '遠洋漁業',
    '沖合漁業',
    '沿岸漁業',
    '定置網漁業',
    '底引き網漁業',
    'まき網網漁業',
    '釣り漁業',
    '延縄漁業',
    'いか釣り漁業',
    'まぐろ漁業',
    'かつお一本釣り',
    '鯨調査捕獲',
    'イルカ漁',
    '海女漁',
    '海女漁業者',
    '素潜り漁'
  ];
  const negate = [
    'still awaiting the deckhand license',
    'still awaiting the fishery cert',
    'まだ免状前',
    'まだ登録申請中',
    'これから講習',
    'まだ試験前'
  ];
  const nullPins = ['about to visit the fishery office', 'about to file the crew report'];
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
