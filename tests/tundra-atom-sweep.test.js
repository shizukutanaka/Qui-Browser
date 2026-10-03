// pass DCCXV: hazardous-materials licensing -> close-tab
// (EN hazmat/fuel-depot forms + JA 毒物劇物・危険物・高圧ガス・揮発油・火災予防)
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

describe('pass DCCXV: hazardous-materials licensing (tundra)', () => {
  const closeTab = ['hazmat licensed', 'depot tank certified', 'fuel station permitted'];
  const closeTabJa = [
    '毒物',
    '劇物',
    '毒劇物',
    '毒物劇物',
    '毒物劇物取締法',
    '毒物劇物営業者',
    '毒物劇物取扱責任者',
    '劇物販売',
    '毒物販売',
    '劇毒物',
    '殺鼠剤',
    '危険物',
    '危険物取扱',
    '危険物取扱者',
    '危険物取扱主任者',
    '危険物施設',
    '危険物倉庫',
    '危険物貯蔵',
    '危険物運送',
    '危険物輸送',
    '危険物製造所',
    '危険物貯蔵所',
    '危険物取扱所',
    '危険物指定数量',
    '指定数量',
    '危険物保安',
    '危険物試験',
    '危険物第四類',
    '第四類危険物',
    '危険物乙種',
    '危険物甲種',
    '危険物乙四',
    '危険物検査',
    '危険物標識',
    '危険物許可',
    '危険物届出',
    '高圧ガス',
    '高圧ガス保安法',
    '高圧ガス製造',
    '高圧ガス販売',
    '高圧ガス貯蔵',
    '高圧ガス保安責任者',
    '高圧ガス販売主任者',
    '高圧ガス保安協会',
    '圧縮ガス',
    '液化ガス',
    '可燃性ガス',
    'ガスボンベ',
    'ボンベ',
    'ガス容器',
    '容器検査',
    '耐圧試験',
    '液化石油ガス',
    'lpガス',
    'lpg',
    'プロパンガス',
    'プロパン',
    'ガス充填所',
    'ガスタンク',
    'ガスメーター',
    'ガス漏れ',
    'ガス警報器',
    '揮発油',
    '揮発油販売業',
    'ガソリン',
    'ガソリンスタンド',
    '給油所',
    '給油',
    '軽油',
    '灯油',
    '燃料貯蔵',
    '地下タンク',
    '貯油',
    '油槽所',
    '石油製品',
    '可燃性液体',
    '引火性液体',
    '消防法',
    '消火器',
    '消火設備',
    'スプリンクラー',
    '泡消火',
    '自衛消防',
    '火災予防',
    '火災報知機',
    '火気厳禁',
    '避難器具'
  ];
  const negate = [
    'still awaiting the hazmat license',
    'still awaiting the fuel permit',
    'まだ積荷前',
    'まだ給油前',
    'これから充填'
  ];
  const nullPins = ['about to visit the fuel depot', 'about to file the hazmat manifest'];
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
