// pass DCCXXX: real-estate appraisal & property-domain terms -> close-tab
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

describe('pass DCCXXX: real-estate appraisal domain (kagura-suzu)', () => {
  const closeTab = ['surveyor licensed', 'geologist certified', 'assayer registered'];
  const closeTabJa = [
    '不動産鑑定士',
    '不動産鑑定士試験',
    '不動産鑑定士会',
    '不動産鑑定士補',
    '不動産鑑定業者',
    '不動産鑑定',
    '地価公示',
    '地価調査',
    '基準地標準地',
    '不動産評価',
    '不動産評価書',
    '不動産評価士',
    '不動産鑑定評価基準',
    '鑑定評価報酬',
    '不動産コンサルティング技能試験',
    '不動産コンサルティング技能士',
    '不動産仲介士',
    '不動産エバリュエーション専門士',
    '不動産実務検定',
    '不動産キャリアパーソン',
    '不動産証券化協会',
    '不動産証券化',
    '不動産投資顧問業',
    '不動産特定共同事業',
    '不動産特定共同事業者',
    '不動産小口化商品',
    '不動産信託受益権販売',
    '不動産市場',
    '不動産流通',
    '不動産流通機構',
    '指定流通機構',
    '不動産情報',
    'レインズ',
    '物件調査',
    '現地調査',
    '囲い込み',
    '不動産広告',
    '不動産チラシ',
    '価格査定',
    '査定価格',
    '土地価格',
    '路線価',
    '公示価格',
    '基準地価格',
    '固定資産評価額',
    '相続税評価額',
    '不動産取得税',
    '登録免許税',
    '消費税課税',
    '売買契約書',
    '瑕疵担保',
    '瑕疵担保責任',
    '告知書',
    '手付金',
    '手付解除',
    '売買成立',
    '決済',
    '引渡',
    '物件引渡',
    '鍵渡し',
    '抵当権設定',
    '抵当権抹消',
    '所有権移転',
    '仮登記',
    '予告登記',
    '所有権移転登記',
    '抵当権設定登記',
    '買戻し',
    '抵当権実行',
    '競売',
    '公売',
    '任意売却',
    '不動産競売',
    '競落',
    '落札人',
    '売却価格',
    '分割金',
    '代金納付',
    '資金計画',
    '住宅ローン減税',
    '贈与税非課税',
    '持分',
    '共有持分',
    '隣地',
    '越境',
    '境界確認',
    '境界標',
    '空き家管理',
    '空き家対策',
    '空地管理',
    '底地',
    '借地権',
    '借地権割合',
    '定期借地権',
    '建物譲渡特約',
    '地上権',
    '地役権',
    '敷金返還',
    '原状回復',
    '入居者退去',
    '立ち退き料',
    '更新料',
    '家賃保証',
    '保証会社',
    '連帯保証人',
    '家賃滞納',
    '賃貸トラブル',
    '不動産管理会社',
    'マンション管理士',
    '管理業務主任者',
    'ビル経営管理士',
    '設備維持管理士',
    '環境維持管理員'
  ];
  const negate = [
    'still awaiting the surveyor license',
    'still awaiting the geologist cert',
    'まだ鑑定前',
    'まだ査定前',
    'これから査定',
    'まだ結果待ち'
  ];
  const nullPins = ['about to visit the registry office', 'about to file the survey report'];
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
