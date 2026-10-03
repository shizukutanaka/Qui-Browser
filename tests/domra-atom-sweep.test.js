// pass DCCXXI: medical & allied-health profession licenses -> close-tab
// (EN professional-board forms + JA 医師・薬剤師・看護・リハ・あはき・柔整系)
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

describe('pass DCCXXI: medical & allied-health profession licenses (domra)', () => {
  const closeTab = ['medical association chartered', 'dental board certified', 'nursing council registered'];
  const closeTabJa = [
    '医師法',
    '医師免許',
    '医師会',
    '日本医師会',
    '歯科医師法',
    '歯科医師免許',
    '歯科医師会',
    '日本歯科医師会',
    '薬剤師法',
    '薬剤師免許',
    '薬剤師会',
    '日本薬剤師会',
    '薬局開設',
    '調剤薬局',
    'ドラッグストア',
    '薬局薬剤師',
    '管理薬剤師',
    '保健師助産師看護師法',
    '保助看法',
    '看護師免許',
    '准看護師',
    '看護師国家試験',
    '助産師',
    '助産師国家試験',
    '助産所',
    '保健師',
    '保健師国家試験',
    '看護協会',
    '日本看護協会',
    '訪問看護ステーション',
    '看護小規模多機能',
    '理学療法士',
    '理学療法士免許',
    '作業療法士',
    '作業療法士免許',
    '言語聴覚士',
    '言語聴覚士免許',
    '視能訓練士',
    '視能訓練士免許',
    '義肢装具士',
    '歯科衛生士',
    '歯科衛生士免許',
    '歯科技工士',
    '歯科技工士免許',
    '診療放射線技師',
    '放射線技師免許',
    '臨床検査技師',
    '衛生検査技師',
    '臨床工学技士',
    '管理栄養士',
    '管理栄養士免許',
    '栄養士免許',
    '栄養士',
    'あん摩マッサージ指圧師',
    'あはき師',
    '鍼灸師',
    'はり師',
    'きゅう師',
    '鍼灸院',
    '柔道整復師',
    '柔整師',
    '整骨院',
    '接骨院',
    '整体院',
    '臨床心理士',
    '公認心理師',
    '公認心理師法',
    '精神保健福祉士',
    '社会福祉士',
    '介護福祉士免許',
    '保育士資格',
    '保育士証',
    '登録販売者',
    '毒物劇物取扱責任者',
    '医療事務',
    '診療報酬請求事務',
    '治療院',
    '施術所',
    '施術所届出',
    'ほねつぎ',
    '救命救急士',
    '救急救命士法',
    '救急救命士国家試験',
    '防災士',
    '防災介助士',
    '栄養管理士',
    'フードコーディネーター',
    '食生活アドバイザー',
    '調理師免許',
    '調理師試験',
    '製菓衛生師',
    '食品衛生責任者',
    '食品衛生管理者'
  ];
  const negate = [
    'still awaiting the nursing license',
    'still awaiting the pharmacy permit',
    'まだ開業届前',
    'まだ施術前',
    'これから開業'
  ];
  const nullPins = ['about to visit the medical board', 'about to file the nursing report'];
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
