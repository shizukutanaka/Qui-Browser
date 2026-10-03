// pass DCCXVII: medical & welfare profession licenses -> close-tab
// (EN physician/nurse forms + JA 医師・歯科医師・看護師・リハ職・薬剤師・栄養士・保育士)
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

describe('pass DCCXVII: medical & welfare profession licenses (vielle)', () => {
  const closeTab = ['physician licensed', 'nurse registered', 'clinic director certified'];
  const closeTabJa = [
    '医師',
    '医師法',
    '医師免許',
    '医師国家試験',
    '医師会',
    '開業医',
    '勤務医',
    '研修医',
    '専門医',
    '指導医',
    '認定医',
    '総合診療医',
    '家庭医',
    'かかりつけ医',
    '医療法人',
    '診療所',
    '診療科',
    '保険医',
    '保険医療機関',
    '歯科医師',
    '歯科医師法',
    '歯科医師免許',
    '歯科医院',
    '歯科診療所',
    '歯科医師会',
    '歯科衛生士',
    '歯科技工士',
    '歯科技工所',
    '歯科助手',
    '看護師',
    '看護師法',
    '看護師免許',
    '看護職',
    '保健師',
    '保健師法',
    '助産師',
    '助産師法',
    '助産所',
    '准看護師',
    '認定看護師',
    '専門看護師',
    '診療看護師',
    '看護職員',
    '理学療法士',
    '作業療法士',
    '言語聴覚士',
    'リハビリテーション',
    'pt',
    'ot',
    'st',
    '臨床検査技師',
    '診療放射線技師',
    '放射線技師',
    '臨床工学技士',
    '視能訓練士',
    '義肢装具士',
    '救急救命士',
    '薬剤師',
    '薬剤師法',
    '薬剤師免許',
    '薬剤部',
    '調剤師',
    '登録販売者',
    '販売従事登録',
    '栄養士',
    '管理栄養士',
    '栄養士免許',
    '栄養指導',
    '調理師',
    '調理師法',
    '調理師免許',
    '製菓衛生師',
    '食品衛生管理者',
    '食品衛生責任者',
    '衛生管理者',
    '保育士',
    '保育士資格',
    '幼稚園教諭',
    '教員免許',
    '教諭',
    '養護教諭',
    '栄養教諭',
    '社会福祉士',
    '介護福祉士',
    '精神保健福祉士',
    'ケアマネージャー',
    'ホームヘルパー',
    '臨床心理士',
    '公認心理師',
    '保健所',
    '保健所長'
  ];
  const negate = [
    'still awaiting the medical license',
    'still awaiting the nursing license',
    'まだ開業前',
    'まだ認定前',
    'これから診療'
  ];
  const nullPins = ['about to visit the clinic', 'about to file the medical license'];
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
