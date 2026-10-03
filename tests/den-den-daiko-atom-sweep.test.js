// pass DCCXXXI: medical-office & pharmacy administration domain -> close-tab
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

describe('pass DCCXXXI: medical-office & pharmacy admin (den-den-daiko)', () => {
  const closeTab = ['records clerk certified', 'billing specialist registered', 'hospital admin licensed'];
  const closeTabJa = [
    '診療情報管理士',
    '診療情報管理士試験',
    '診療情報管理士会',
    '診療情報管理',
    '医療情報技師',
    '医療情報システム',
    '電子カルテ',
    'カルテ管理',
    'レセプト',
    'レセプト業務',
    'レセプト点検',
    '診療報酬請求事務能力認定試験',
    '医科医療事務検定',
    '医療事務検定',
    '医療事務技能審査試験',
    '医療事務',
    '医療事務員',
    '医療秘書',
    'メディカルクラーク',
    'ドクターズクラーク',
    '歯科医療事務',
    '歯科助手',
    '看護助手',
    '病院事務員',
    '医療保険士',
    '調剤事務管理士',
    '調剤報酬請求事務',
    '薬局事務',
    '医療事務コンピュータ',
    '医療事務認定実務者',
    'ホスピタルコンシェルジュ',
    '医療接遇',
    '医療接遇技能認定',
    '患者対応',
    '受付業務',
    '外来事務',
    '入院事務',
    '医事課',
    '医事管理',
    '医事業務',
    '医療安全管理者',
    '医療安全管理',
    '院内感染対策',
    '医療事故',
    '医療事故防止',
    '医療ヒヤリハット',
    'インシデント報告',
    '医療機器安全管理士',
    '医療機器情報コミュニケーター',
    '医療経営士',
    '病院経営管理士',
    '医療経営',
    '病院管理',
    '医療法人',
    '医療法人運営',
    '診療所開設',
    '医療法人登記',
    '病院機能評価',
    '医療機能評価',
    '地域医療連携',
    '地域連携クリティカルパス',
    '診療連携',
    '病診連携',
    '紹介状',
    '逆紹介',
    '地域医療',
    '医療計画',
    '地域医療構想',
    '医療圏',
    '医療圏調整',
    '医療法人経営',
    '医療広告規制',
    '医療広告ガイドライン',
    '診療科',
    '標榜科目',
    '医療機関',
    '医療機関指定',
    '保険医療機関',
    '保険医登録',
    '医療観察法',
    '医療行政',
    '保健所',
    '保健所行政',
    '衛生主管',
    '医療資格',
    '医療国家資格',
    '登録販売者',
    '登録販売者試験',
    '登録販売者資格',
    '医薬品登録販売者',
    '医薬品販売',
    '一般用医薬品',
    '要指導医薬品',
    '第一類医薬品',
    '第二類医薬品',
    '第三類医薬品',
    '指定第二類医薬品',
    '医薬品医療機器法',
    '薬機法',
    '医薬品安全管理',
    '薬局管理体制',
    '医薬品卸売業',
    '配置販売業',
    '配置薬',
    '置き薬',
    'ドラッグストア',
    '薬局開設',
    '調剤薬局',
    '病院薬剤部',
    '医薬分業',
    '医薬品等製造販売業',
    '医薬品製造業',
    '医薬品卸業',
    '医療機器販売業',
    '医療機器貸与業',
    '医療機器修理業',
    '管理医療機器',
    '高度管理医療機器',
    '特定保守管理医療機器',
    '医療機器販売管理者',
    '医療機器責任技術者'
  ];
  const negate = [
    'still awaiting the clerk license',
    'still awaiting the billing cert',
    'まだ認定試験前',
    'まだ審査前',
    'これから受験',
    'まだ結果発表'
  ];
  const nullPins = ['about to visit the clerk office', 'about to file the billing report'];
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
