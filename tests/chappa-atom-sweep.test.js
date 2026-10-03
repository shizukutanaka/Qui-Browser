// pass DCCXXVIII: notary, scrivener & safety-officer professions -> close-tab
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

describe('pass DCCXXVIII: notary & safety professions (chappa)', () => {
  const closeTab = ['notary licensed', 'legal scrivener registered', 'safety officer certified'];
  const closeTabJa = [
    '公証人',
    '公証人役場',
    '公証役場',
    '公証人任命',
    '公証',
    '定款認証',
    '公正証書',
    '私署証書認証',
    '契約書認証',
    '遺言公正証書',
    '宣言取次',
    '電子公証',
    '公証費用',
    '行政書士',
    '行政書士試験',
    '行政書士登録',
    '行政書士会',
    '行政書士事務所',
    '書類作成業務',
    '許認可申請',
    '申請取次',
    '官公署手続',
    '書類作成',
    '司法書士',
    '司法書士試験',
    '司法書士登録',
    '司法書士会',
    '司法書士事務所',
    '登記申請',
    '登記業務',
    '不動産登記申請',
    '商業登記',
    '会社設立登記',
    '登記事項証明書',
    '登記簿謄本',
    '簡裁訴訟代理',
    '成年後見人',
    '本人訴訟',
    '海事代理士',
    '海事代理士試験',
    '土地家屋調査士',
    '測量士補',
    '貸金業務取扱主任者',
    '労働安全衛生管理者',
    '衛生管理者試験',
    '安全衛生管理責任者',
    '衛生管理者',
    '産業安全衛生管理者',
    '危険物取扱者',
    '危険物取扱者免状',
    '乙種第四類',
    '消防設備士',
    '消防設備士免状',
    '消防設備点検資格者',
    '防火管理者',
    '防火管理責任者',
    '防災管理者',
    '防災管理点検資格者',
    '建設業経理検定士',
    '技能士',
    '技能検定',
    '技能五輪',
    '職業訓練指導員',
    '職業訓練指導員免許',
    '職業訓練講師',
    'キャリアコンサルタント',
    'キャリアコンサルティング技能士',
    '社労士',
    '社会保険労務士',
    '社労士試験',
    '社労士登録',
    '社労士会',
    '労務管理',
    '給与計算',
    '助成金申請',
    '就業規則作成',
    '労働保険',
    '社会保険手続',
    '年金手続'
  ];
  const negate = [
    'still awaiting the notary license',
    'still awaiting the scrivener exam',
    'まだ免許取得前',
    'まだ認証前',
    'これから登録',
    'まだ合格発表'
  ];
  const nullPins = ['about to visit the notary office', 'about to file the scrivener report'];
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
