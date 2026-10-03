// pass DCCXXXV: sake-brewing & kuramoto domain -> close-tab
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

describe('pass DCCXXXV: sake-brewing & kuramoto domain (flageolet)', () => {
  const closeTab = ['brewmaster licensed', 'vintner certified', 'distiller registered'];
  const closeTabJa = [
    '杜氏',
    '杜氏組合',
    '南部杜氏',
    '越後杜氏',
    '丹波杜氏',
    '酒造組合',
    '酒造家',
    '醸造家',
    '醸造士',
    '醸造技師',
    '蔵人',
    '蔵元',
    '酒蔵',
    '日本酒醸造',
    '日本酒蔵',
    '清酒製造',
    '清酒醸造',
    '本醸造',
    '純米酒',
    '吟醸酒',
    '大吟醸',
    '純米吟醸',
    '純米大吟醸',
    '生酒',
    '生貯蔵酒',
    '生詰め',
    '原酒',
    '古酒',
    '長期熟成酒',
    'にごり酒',
    '濁酒',
    'どぶろく',
    '新酒',
    'しぼりたて',
    '荒走り',
    '中取り',
    '責め',
    '槽口',
    '槽掛け',
    '搾り機',
    '圧搾',
    '袋吊り',
    '斗瓶囲い',
    '遠心分離搾り',
    '醪',
    '酒母',
    '速醸酛',
    '生酛',
    '山廃',
    '山廃仕込み',
    '菩提酛',
    '高温糖化酛',
    '乳酸菌添加',
    '酵母無添加',
    '蔵付き酵母',
    '協会酵母',
    'きょうかい酵母',
    '酒造好適米',
    '山田錦',
    '五百万石',
    '美山錦',
    '雄町',
    '愛山',
    '出羽燦々',
    '吟のさと',
    '夢酒米',
    '酒米',
    '精米歩合',
    '精米機',
    '米麹',
    '麹菌',
    '黄麹菌',
    '白麹',
    '黒麹',
    '麹室',
    '麹蓋',
    '蓋麹',
    '箱麹',
    '床麹',
    '製麹',
    '出麹',
    '破精込み',
    '破精出し',
    '添え麹',
    '掛け麹',
    '仲仕事',
    '留仕事',
    '三段仕込み',
    '四段仕込み',
    '仕込み配合',
    '汲み水',
    '仕込み水',
    '和釜',
    '蒸米',
    '放冷',
    '引き込み',
    '櫂入れ',
    '櫂棒',
    'タンク',
    '貯蔵タンク',
    '甕',
    '樽酒',
    '杉樽',
    '貯蔵熟成',
    '冷蔵熟成',
    '氷温熟成',
    '雪中貯蔵',
    '火入れ',
    '低温殺菌',
    'パスチャライゼーション',
    '瓶燗火入れ',
    '一回火入れ',
    '無濾過',
    '粗濾過',
    '活性炭素過',
    'ろ過機',
    '澱引き',
    'おり引き',
    '滓絡み',
    '加水調整',
    '割水',
    '度数調整',
    'アルコール度数',
    '日本酒度',
    '酸度',
    'アミノ酸度',
    '甘辛度',
    '原料米',
    '表示米',
    'ラベル表示',
    '自家醸造',
    '地酒',
    'ご当地酒',
    '日本酒フェア',
    '利き酒',
    '利酒師',
    '唎酒師',
    'きき酒師',
    '日本酒学講師',
    '日本酒ナビゲーター',
    '酒匠'
  ];
  const negate = [
    'still awaiting the brewmaster license',
    'still awaiting the vintner cert',
    'まだ醸造前',
    'まだ免許前',
    'これから仕込み',
    'まだ開業前'
  ];
  const nullPins = ['about to visit the brewery office', 'about to file the sake report'];
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
