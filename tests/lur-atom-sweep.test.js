// pass DCCXXII: tax & accounting profession / filing operations -> close-tab
// (EN tax-profession forms + JA 税理士・会計士・申告・控除・消費税系)
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

describe('pass DCCXXII: tax & accounting professions (lur)', () => {
  const closeTab = ['customs broker licensed', 'patent attorney sworn', 'notary public commissioned'];
  const closeTabJa = [
    '税理士法',
    '税理士',
    '税理士会',
    '日本税理士会',
    '税理士試験',
    '税理士登録',
    '税理士事務所',
    '税務相談',
    '税理士紹介',
    '確定申告代理',
    '税務書類',
    '税務申告',
    '税務調整',
    '記帳代行',
    '帳簿作成',
    '税務アドバイザー',
    '中小企業税務',
    '国税審判官',
    '国税不服審判所',
    '税理士懲戒',
    '税理士バッジ',
    '税理士会計士',
    '公認会計士法',
    '公認会計士',
    '会計士試験',
    '日本公認会計士協会',
    '会計監査人',
    '監査法人',
    '監査法人登録',
    '会計参与',
    '財務報告',
    '内部統制監査',
    '四半期レビュー',
    '英文会計士',
    '米国会計士',
    'uscpa',
    'icpa',
    'ビジネス会計検定',
    '日商簿記',
    '簿記検定',
    '簿記一級',
    '簿記二級',
    '簿記三級',
    '会計実務士',
    '経理事務士',
    '決算書作成',
    '確定申告書',
    '青色申告書',
    '白色申告書',
    '修正申告書',
    '更正の請求書',
    '源泉徴収票提出',
    '給与計算',
    '給与明細',
    '年末調整書',
    '扶養控除申告',
    '基礎控除申告',
    '配偶者控除',
    '医療費控除',
    '寄附金控除',
    '雑損控除',
    '生命保険料控除',
    '地震保険料控除',
    '社会保険料控除',
    '小規模企業共済',
    'ideco申請',
    'つみたて申請',
    '住宅借入金等特別控除',
    '住宅ローン控除',
    'ふるさと納税限度額',
    'ワンストップ特例',
    'e-tax利用',
    '電子申告',
    '税務署',
    '国税局',
    '国税庁',
    '納税管理人',
    '納税義務者',
    '納税者',
    '納税証明',
    '納税証明書',
    '非課税証明',
    '課税証明',
    '所得証明',
    '収入証明',
    '源泉徴収簿',
    '消費税届出',
    '消費税課税事業者',
    '消費税免税事業者',
    '簡易課税',
    '本則課税',
    '課税売上割合',
    '二割特例',
    '税区分',
    '税率区分',
    '軽減税率対象',
    'インボイス登録',
    '適格請求書発行',
    '適格請求書保存',
    '適格返還請求書',
    '仕入税額控除',
    '仮払消費税',
    '仮受消費税'
  ];
  const negate = [
    'still awaiting the tax license',
    'still awaiting the notary commission',
    'まだ申告前',
    'まだ納付期限前',
    'これから申告'
  ];
  const nullPins = ['about to visit the tax office', 'about to file the accountant report'];
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
