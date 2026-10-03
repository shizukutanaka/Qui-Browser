// pass DCCXXVII: childcare, welfare & culinary professions -> close-tab
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

describe('pass DCCXXVII: childcare & culinary professions (trombamarina)', () => {
  const closeTab = ['nursery teacher licensed', 'chef certified', 'nutritionist registered'];
  const closeTabJa = [
    '保育士',
    '保育士試験',
    '保育士登録',
    '保育士資格',
    '保育士免許',
    '保育士会',
    '保育士養成',
    '保育園教諭',
    '保育教諭',
    '幼稚園教諭',
    '幼稚園教諭免許',
    '幼稚園教員免許状',
    '教員免許',
    '教員免許状',
    '教育職員免許状',
    '小学校教諭',
    '中学校教諭',
    '高等学校教諭',
    '特別支援学校教諭',
    '養護教諭',
    '栄養教諭',
    '教員採用試験',
    '教員採用',
    '教職員',
    '教職課程',
    '教育実習',
    '臨時的任用',
    '学級担任',
    '担任',
    '教科担任',
    '学級経営',
    '授業参観',
    '通知表',
    '三者面談',
    '授業カリキュラム',
    '教員研修',
    '教務主任',
    '主任教諭',
    '教頭',
    '校長',
    '校長先生',
    '副校長',
    '学校教育',
    '教育委員会',
    '教委',
    '社会福祉士',
    '社会福祉士試験',
    '社会福祉士登録',
    '福祉士',
    '精神保健福祉士',
    '精神保健福祉士試験',
    '介護支援専門員',
    'ケアマネ',
    'ケアマネージャー',
    'ケアマネ試験',
    '介護支援専門員実務研修',
    '実務研修',
    '主任ケアマネ',
    '主任介護支援専門員',
    '福祉住環境コーディネーター',
    '福祉用具専門相談員',
    '相談支援専門員',
    '介護職員初任者研修',
    '初任者研修',
    '介護実務者研修',
    '実務者研修',
    '介護職',
    '介護職員',
    '介護福祉士国家試験',
    '介護福祉士会',
    '介護施設長',
    'ケアプラン',
    'ケア会議',
    'ケアワーカー',
    'ヘルパー',
    'ホームヘルパー',
    '訪問介護員',
    '児童指導員',
    '児童発達支援管理責任者',
    '児童発達支援士',
    '放課後児童支援員',
    '児童遊戯指導員',
    '児童館職員',
    '保育所',
    '認可保育園',
    '認定こども園',
    '幼稚園',
    'こども園',
    '学童保育',
    '放課後児童クラブ',
    '放課後デイサービス',
    '児童発達支援',
    '障害児通所支援',
    '発達支援',
    '療育',
    '調理師',
    '調理師試験',
    '調理師免許',
    '調理師会',
    '製菓衛生師',
    '製菓衛生師試験',
    '製菓衛生師免許',
    'ふぐ調理師',
    'ふぐ取扱者',
    '食品衛生責任者',
    '食品衛生管理者',
    '栄養士',
    '栄養士免許',
    '管理栄養士',
    '管理栄養士国家試験',
    '管理栄養士会',
    '栄養士会',
    'フードコーディネーター',
    '料理研究家',
    '調理技術技能評価試験',
    '料理検定',
    '料理教室',
    '調理学校',
    '製菓学校',
    '栄養士養成',
    '栄養計算',
    '献立作成',
    '食育',
    '食育インストラクター',
    '食品安全管理士',
    'フードアナリスト'
  ];
  const negate = [
    'still awaiting the teaching license',
    'still awaiting the chef license',
    'まだ免許取得前',
    'まだ採用前',
    'これから赴任',
    'まだ合格前'
  ];
  const nullPins = ['about to visit the licensing office', 'about to file the teacher report'];
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
