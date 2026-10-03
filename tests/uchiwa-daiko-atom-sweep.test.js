// pass DCCXXXIV: funeral-industry & bereavement domain -> close-tab
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

describe('pass DCCXXXIV: funeral-industry & bereavement domain (uchiwa-daiko)', () => {
  const closeTab = ['mortician licensed', 'embalmer certified', 'funeral director registered'];
  const closeTabJa = [
    '葬祭ディレクター',
    '葬祭業',
    '葬儀社',
    '葬儀業者',
    '葬儀場',
    '斎場',
    '葬儀ホール',
    '式場運営',
    '葬祭ホール',
    '葬儀プランナー',
    '葬儀司会者',
    '葬儀スタッフ',
    '葬儀相談員',
    '葬儀事前相談',
    '葬儀施行',
    '葬祭施行',
    '葬送サービス',
    '葬儀サービス',
    '納棺師',
    '湯灌師',
    '湯灌',
    '納棺',
    '搬送業務',
    '搬送業者',
    'ご遺体搬送',
    '霊柩車運転士',
    '霊柩車',
    '寝台車運転',
    '遺体安置所',
    '遺体保管',
    'ドライアイス',
    '防腐処理',
    'エンバーミング',
    '遺体修復師',
    '死化粧',
    '祭壇設置士',
    '祭壇設営',
    '祭壇コーディネーター',
    '生花祭壇',
    '供物管理',
    '遺影制作',
    '遺影写真加工',
    '喪主マニュアル',
    '香典管理',
    '香典返し業者',
    '返礼品発送',
    '会葬御礼',
    '訃報連絡',
    '死亡通知',
    '葬儀保険',
    '互助会',
    '冠婚葬祭互助会',
    '互助会員',
    '葬儀積立',
    '月割金',
    '互助会契約',
    '葬祭給付金',
    '葬祭費',
    '葬祭費請求',
    '埋葬許可証',
    '火葬許可証',
    '火葬場',
    '火葬炉',
    '火葬炉運転士',
    '火葬炉管理者',
    '火葬炉技師',
    '火葬場管理',
    '火葬場予約',
    '火葬炉予約',
    '葬儀終了',
    '精進落とし',
    '忌中払い',
    '四十九日法要',
    '一周忌',
    '三回忌',
    '七回忌',
    '十三回忌',
    '十七回忌',
    '二十三回忌',
    '二十七回忌',
    '三十三回忌',
    '年忌法要',
    '祥月命日',
    '月命日',
    '命日',
    '弔問客',
    '弔電',
    '供花',
    '樹木葬',
    '海洋散骨',
    '散骨',
    '散骨業者',
    '宇宙葬',
    'ダイヤモンド葬',
    '手元供養',
    '遺骨ペンダント',
    '遺骨アクセサリー',
    '遺骨管理',
    '遺骨収蔵',
    '遺骨引取',
    '遺族会',
    '遺族支援',
    'グリーフケア',
    'グリーフサポート',
    '死別カウンセリング',
    'ペット葬儀',
    'ペット火葬',
    'ペット霊園',
    'ペット供養',
    '動物霊園',
    'ペット葬祭ディレクター'
  ];
  const negate = [
    'still awaiting the mortician license',
    'still awaiting the embalmer cert',
    'まだ施行前',
    'まだ申請前',
    'これから施行',
    'まだ開業前'
  ];
  const nullPins = ['about to visit the funeral home', 'about to file the burial report'];
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
