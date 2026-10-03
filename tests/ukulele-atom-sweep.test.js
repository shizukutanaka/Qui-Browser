// pass DCCXVI: electrical-work & radio-license -> close-tab
// (EN electrician/radio forms + JA 電気工事士・電気主任技術者・電気用品・無線従事者)
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

describe('pass DCCXVI: electrical-work & radio-license (ukulele)', () => {
  const closeTab = ['electrician licensed', 'circuit certified', 'meter base approved'];
  const closeTabJa = [
    '電気工事士',
    '第一種電気工事士',
    '第二種電気工事士',
    '電気工事士法',
    '電気工事',
    '電気工事業',
    '電気工事店',
    '電気工事士登録',
    '電気工事士免状',
    '電気工事士試験',
    '電気工事士資格',
    '電気工事士免状交付',
    '電気工事士免状書換',
    '電気工事士免状再交付',
    '電気主任技術者',
    '第一種電気主任技術者',
    '第二種電気主任技術者',
    '第三種電気主任技術者',
    '電気主任技術者免状',
    '電気主任技術者選任',
    '電気主任技術者届出',
    '電気主任技術者試験',
    '電気主任技術者資格',
    '電気主任技術者養成',
    '電気保安',
    '電気保安業務',
    '電気保安管理',
    '電気保安協会',
    '電気保安点検',
    '電気定期点検',
    '電気設備点検',
    '電気保安責任者',
    '電気保安係員',
    '電気保安事業場',
    '電気事業法',
    '電気事業者',
    '電気事業用電気工作物',
    '電気工作物',
    '電気工作物設置届',
    '電気工作物検査',
    '電気工作物使用前検査',
    '電気工作物定期検査',
    '電気工作物保安規程',
    '自家用電気工作物',
    '一般用電気工作物',
    '受電設備',
    '変電設備',
    '高圧受電',
    '特高受電',
    'キュービクル',
    '遮断器',
    '絶縁抵抗',
    '接地抵抗',
    'アース工事',
    '漏電遮断器',
    '感電事故',
    '電気火災',
    '短絡',
    '過負荷',
    '漏電検査',
    '電気用品',
    '電気用品安全法',
    '電気用品製造届',
    '電気用品輸入届',
    'pse',
    'pseマーク',
    'pse認証',
    '電気用品検査',
    '電気用品規格',
    '菱形pse',
    '丸形pse',
    '特定電気用品',
    '電気用品事故報告',
    '家電リサイクル',
    '廃家電',
    'コンセント',
    '電源プラグ',
    '配線工事',
    'コンセント増設',
    '分電盤',
    'アンペア',
    'ブレーカー',
    '無線資格',
    '無線従事者',
    '総合無線通信士',
    '海上無線通信士',
    '航空無線通信士',
    '陸上特殊無線技士',
    'アマチュア無線',
    'アマチュア無線技士',
    'アマチュア無線局',
    'アマチュア無線免許',
    'アマチュア無線免許状',
    'アマチュア無線局免許',
    'アマチュア無線検定',
    '無線局',
    '無線局免許',
    '無線局開設',
    '無線局検査',
    '無線局免許状',
    '無線設備',
    '空中線',
    'アンテナ',
    '送信機',
    '受信機',
    '電波法',
    '電波利用料',
    '混信',
    '周波数帯'
  ];
  const negate = [
    'still awaiting the electrician license',
    'still awaiting the radio license',
    'まだ工事届前',
    'まだ免状前',
    'これから開局'
  ];
  const nullPins = ['about to visit the electrical office', 'about to file the radio license'];
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
