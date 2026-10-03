// pass DCCXXIX: meteorology, disaster & insurance-assessment certs -> close-tab
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

describe('pass DCCXXIX: disaster & assessment certs (atsume)', () => {
  const closeTab = ['examiner certified', 'auditor registered', 'inspector licensed'];
  const closeTabJa = [
    '気象予報士',
    '気象予報士試験',
    '気象予報士会',
    '気象キャスター',
    '気象防災アドバイザー',
    '防災気象情報員',
    '地震津波防災士',
    '気象科学士',
    '応用気象技術者',
    '気象観測技術者',
    '気象測器技士',
    '航空気象予測士',
    '防災士',
    '防災士認定',
    '防災介助士',
    '危機管理士',
    '危機管理診断士',
    '災害危機管理士',
    '災害復旧技術士',
    '土砂災害防止士',
    '地すべり防止技士',
    '砂防技士',
    '急傾斜地崩壊防止技士',
    '保全治山技士',
    '災害査定士',
    '防災情報士',
    '危機管理評価士',
    '災害備蓄管理士',
    '帰宅困難者対策',
    '防災計画',
    '地域防災',
    '自主防災組織',
    '防災リーダー',
    '避難所運営',
    '避難行動要支援者',
    '災害ボランティアコーディネーター',
    '被災者支援',
    '災害危機管理者',
    '自然災害調査士',
    '地震保険調査員',
    '損害保険登録鑑定人',
    '損害保険鑑定人',
    '保険鑑定人',
    '火災保険鑑定人',
    '自動車保険鑑定人',
    '損害調査員',
    '保険調査員',
    'アジャスター',
    'クレームアジャスター',
    '保険数理士',
    'アクチュアリー',
    '保険計理士',
    '年金数理士',
    'リスク管理士',
    'リスクマネージメント試験',
    'リスク管理検定',
    '金融リスク管理者',
    '認定リスクコンサルタント',
    '事業継続管理者',
    '事業継続計画',
    '事業継続',
    'bcp',
    '危機管理計画',
    '危機管理対策',
    '事業継続マネジメント',
    '事業継続管理士',
    'bcms',
    '防災管理士',
    '交通安全士',
    '交通安全アドバイザー',
    '交通安全指導員',
    '交通指導員',
    '防犯指導員',
    '防犯アドバイザー',
    '防犯設備士',
    '防犯システム診断士',
    '防犯診断士',
    '防犯設計士',
    '防犯設備協会',
    '警備保障協会',
    '警備業協会',
    '警備連合会'
  ];
  const negate = [
    'still awaiting the examiner license',
    'still awaiting the disaster cert',
    'まだ認定前',
    'まだ資格前',
    'これから受験',
    'まだ試験日'
  ];
  const nullPins = ['about to visit the examiner office', 'about to file the inspector report'];
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
