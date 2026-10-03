// pass DCCXXXIII: shorthand, court-records & accessibility-interpreting domain -> close-tab
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

describe('pass DCCXXXIII: shorthand & court-records domain (binzasara)', () => {
  const closeTab = ['stenographer certified', 'court reporter licensed', 'typist registered'];
  const closeTabJa = [
    '法廷通訳士',
    '司法通訳',
    '医療通訳士',
    '医療通訳',
    'コミュニティ通訳',
    '手話通訳士',
    '手話通訳者',
    '手話通訳士認定',
    '手話検定',
    '日本手話',
    '手指日本語対応',
    '要約筆記者',
    '要約筆記',
    '速記者',
    '速記士',
    '議事録作成',
    '文字通訳',
    '字幕制作',
    'テープ起こし',
    '議事録士',
    '会議録作成者',
    'スタノグラファー',
    'スピードライティング',
    '司法記録官',
    '裁判速記官',
    '証言録取',
    '供述調書',
    '取調べ録画',
    '公判記録',
    '判決要旨',
    '裁判書記官',
    '検事記録官',
    '公安調査庁記録官',
    '書記官',
    '裁判所書記官',
    '簡易裁判所書記官',
    '家庭裁判所書記官',
    '控訴記録',
    '上告記録',
    '記録課',
    '記録係',
    '執行官',
    '執行吏',
    '競売執行官',
    '執行手続',
    '執行文',
    '債務名義',
    '強制執行官',
    '民事執行',
    '債権執行',
    '不動産執行',
    '物件執行',
    '仮差押',
    '仮処分執行',
    '保全執行',
    '登記所勤務',
    '供託所',
    '供託',
    '供託書',
    '供託手続',
    '提訴記録',
    '調書作成',
    '調書検証',
    '証拠調書',
    '供述書',
    '答弁書作成',
    '準備書面作成',
    '判決謄本',
    '判決書記録',
    '判決登記'
  ];
  const negate = [
    'still awaiting the stenographer license',
    'still awaiting the reporter cert',
    'まだ認定試験前',
    'まだ採用前',
    'これから登録',
    'まだ研修中'
  ];
  const nullPins = ['about to visit the court office', 'about to file the transcript report'];
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
