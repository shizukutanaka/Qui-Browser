// pass DCCXIII: liquor & tobacco retail licensing -> close-tab
// (EN liquor/bottle-shop/wine-shop forms + JA 酒類・醸造・ビール低アル・飲用・たばこ・喫煙規制)
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

describe('pass DCCXIII: liquor & tobacco retail licensing (sutra)', () => {
  const closeTab = ['liquor licensed', 'bottle shop permitted', 'wine shop certified'];
  const closeTabJa = [
    '酒類',
    '酒類販売',
    '酒類販売業免許',
    '酒販',
    '酒販免許',
    '酒税',
    '酒税法',
    '酒屋',
    '酒店',
    '角打ち',
    '酒類小売業',
    '酒類卸売業',
    '酒類販売管理研修受講証',
    '酒類販売管理者',
    '通信販売酒類小売業免許',
    '輸入酒類',
    '輸出酒類',
    '酒類卸',
    '酒造',
    '醸造場',
    '造り酒屋',
    '酒蔵',
    '本格焼酎',
    '泡盛',
    '日本酒',
    '清酒',
    '吟醸酒',
    '純米酒',
    '梅酒',
    '果実酒',
    'リキュール',
    'ウイスキー',
    'ブランデー',
    'ビール',
    '発泡酒',
    '第三のビール',
    '地ビール',
    'クラフトビール',
    'ワイン',
    'シャンパン',
    'スパークリングワイン',
    'シードル',
    'ハイボール',
    '酎ハイ',
    'チューハイ',
    'カクテル',
    'アルコール度数',
    'アルコール分',
    '飲酒運転',
    '飲酒',
    '禁酒',
    '宅飲み',
    '晩酌',
    '開栓',
    '一升瓶',
    '四合瓶',
    '徳利',
    '猪口',
    '酒器',
    'たばこ',
    'タバコ',
    '煙草',
    'たばこ小売',
    'たばこ販売',
    'たばこ小売販売人',
    'たばこ税',
    'たばこ事業法',
    '紙巻たばこ',
    '加熱式たばこ',
    '電子たばこ',
    'たばこ店',
    '喫煙所',
    '喫煙室',
    '分煙',
    '禁煙',
    '受動喫煙',
    '未成年喫煙',
    'たばこ自販機',
    '成年識別カード',
    'taspo',
    'ニコチン',
    'タール'
  ];
  const negate = ['still awaiting the liquor license', 'まだ醸造中', 'まだ喫煙中', 'まだ開栓前', 'これから飲酒'];
  const nullPins = ['about to visit the bottle shop', 'about to file the liquor permit'];
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
