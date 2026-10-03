// pass DCCXX: telecom & broadcast network operations -> close-tab
// (EN communications/broadcast forms + JA 電気通信・移動体通信・ケーブル放送)
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

describe('pass DCCXX: telecom & broadcast network operations (gusli)', () => {
  const closeTab = ['communications bureau licensed', 'news agency registered', 'postal operator certified'];
  const closeTabJa = [
    '電気通信事業法',
    '電気通信事業',
    '電気通信事業者',
    '電気通信事業登録',
    '届出電気通信事業者',
    '登録電気通信事業者',
    '電気通信主任技術者',
    '電気通信工事',
    '線路設備',
    '通信線路',
    '電柱',
    '電柱管理者',
    '光ケーブル',
    '光ファイバ',
    '加入者線',
    'アクセス回線',
    '中継回線',
    '基幹回線',
    '地域回線',
    '移動通信',
    '移動体通信',
    '携帯電話事業',
    '携帯キャリア',
    'mvno',
    '仮想移動体通信事業者',
    '基地局',
    '無線基地局',
    'アンテナ設置',
    '鉄塔',
    '通信鉄塔',
    '携帯基地局',
    '通信障害',
    '通信品質',
    '帯域',
    '周波数帯',
    '割当周波数',
    '特定基地局',
    '開設届',
    '開設計画',
    '通信規格',
    '相互接続',
    '接続協定',
    '接続料',
    '卸料金',
    'ユニバーサルサービス',
    'ユニバーサル料金',
    'あんしん電話',
    '固定電話契約',
    'ip電話',
    '光電話',
    'ひかり電話',
    '電話番号割当',
    '番号ポータビリティ',
    'mnp',
    '番号持ち運び',
    '携帯番号',
    '緊急通報',
    '緊急通報位置通知',
    '着信課金',
    'フリーダイヤル',
    'ナビダイヤル',
    'ケーブルテレビ',
    'ケーブルテレビ事業',
    'catv',
    '有線テレビジョン放送',
    '自主放送',
    '共同受信',
    '聴取料',
    '受信料',
    '受信契約',
    '衛星受信',
    'bs放送',
    'cs放送',
    'デジタル放送',
    'データ放送',
    'ワンセグ',
    'フルセグ',
    'ハイブリッドキャスト',
    '放送受信機',
    '受信機',
    'チューナー',
    'アンテナ工事',
    '地デジアンテナ',
    '放送センター',
    '送信所',
    '中継所',
    '非常用設備',
    '緊急警報放送',
    'etws',
    '津波警報',
    '緊急速報',
    'エリアメール',
    'jアラート',
    '放送通信連携',
    '通信放送連携',
    '放送通信融合',
    '放送コンテンツ',
    '見逃し配信',
    'tver',
    '同時配信'
  ];
  const negate = [
    'still awaiting the telecom license',
    'still awaiting the broadcast permit',
    'まだ開局前',
    'まだ届出前',
    'これから開設'
  ];
  const nullPins = ['about to visit the telecom bureau', 'about to file the broadcast notice'];
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
