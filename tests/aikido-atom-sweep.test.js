// pass DCCLX: aikido & aikidoka domain -> close-tab
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

describe('pass DCCLX: aikido & aikidoka domain (aikido)', () => {
  const closeTab = ['aikido practitioner licensed', 'aikido master certified', 'aikido instructor registered'];
  const closeTabJa = [
    '合気道',
    '合気',
    '合氣',
    '合気道家',
    '合気道選手',
    '合気道場',
    '合気道教室',
    '合気道部',
    '合気会',
    '養神館',
    '国際合気道連盟',
    '日本合気道協会',
    '合気道審査',
    '開祖',
    '合気道開祖',
    '植芝盛平',
    '植芝吉祥丸',
    '植芝守央',
    '植芝繁栄',
    '塩田剛三',
    '藤平光一',
    '磯山博',
    '斉藤守弘',
    '一教',
    '二教',
    '三教',
    '四教',
    '五教',
    '一教固め',
    '二教固め',
    '三教固め',
    '入身投げ',
    '四方投げ',
    '小手返し',
    '回転投げ',
    '天地投げ',
    '合気投げ',
    '呼吸投げ',
    '隅落とし',
    '肘当て',
    '四方固め',
    '剣取り',
    '杖取り',
    '短刀取り',
    '合気剣',
    '合気杖',
    '木杖',
    '座り技',
    '半身半立ち',
    '正面打ち',
    '横面打ち',
    '正面突き',
    '両手取り',
    '片手取り',
    '交差取り',
    '諸手取り',
    '肩取り',
    '胸取り',
    '後ろ両手取り',
    '自由技',
    '固め技',
    '相対稽古',
    '合気稽古',
    '鍛錬',
    '寒稽古',
    '飛び受身',
    '前転受身',
    '後転受身',
    '入身',
    '転換',
    '体の転換',
    '正中線',
    '丹田',
    '臍下丹田',
    '円の動き',
    '螺旋',
    '呼吸力',
    '合気呼吸',
    '呼吸法',
    '気の流れ',
    '気結び',
    '呼吸動作',
    '調和',
    '和の精神',
    '非暴力',
    '武道精神',
    '技の理',
    '理合い',
    '合気理合',
    '武産',
    '開祖直伝',
    '合気道の理念',
    '合気道訓練',
    '合気道修行',
    '合気道歴',
    '合気齢',
    '師範',
    '合気師範',
    '指導員',
    '合気道指導',
    '合気道人口',
    '全日本合気道演武大会',
    '合気道演武',
    '演武会',
    '合気道基本動作',
    '基本運動',
    '一教運動',
    '入身運動',
    '転換運動',
    '呼吸運動',
    '合気道立技',
    '連続技',
    '変化技',
    '崩し技',
    '裏',
    '表',
    '裏面',
    '表面',
    '裏固め',
    '横面入身',
    '合気道手刀',
    '小手',
    '指先',
    '目線',
    '転体',
    '転身',
    '後退歩',
    '前方回転',
    '後方回転',
    '八方向',
    '八方',
    '表裏一致',
    '円運動',
    '渦巻き運動',
    '球体運動',
    '体術',
    '合気道体術',
    '大東流',
    '大東流合気柔術',
    '武田惣角',
    '富木謙治',
    '岩間',
    '岩間道場',
    '合気神社',
    '合気本部',
    '本部指導部',
    '住み込み弟子',
    '直弟子',
    '入門者',
    '初心者クラス',
    '合同稽古',
    '公開講座',
    '体験稽古'
  ];
  const negate = [
    'still awaiting the aikido license',
    'still awaiting the grading ruling',
    'まだ入身前',
    'まだ投げ前',
    'これから転換',
    'まだ場所前'
  ];
  const nullPins = ['about to visit the aikido dojo', 'about to file the grading report'];
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
