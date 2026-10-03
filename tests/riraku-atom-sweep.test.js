// pass DCCXXXVI: ceramics, pottery & kiln domain -> close-tab
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

describe('pass DCCXXXVI: ceramics & kiln domain (riraku)', () => {
  const closeTab = ['ceramicist licensed', 'potter certified', 'kiln master registered'];
  const closeTabJa = [
    '陶芸家',
    '陶芸士',
    '陶芸作家',
    '陶工',
    '陶磁器作家',
    '陶磁器デザイナー',
    '陶磁器技能士',
    '陶磁器成形士',
    '陶磁器焼成士',
    'ろくろ工',
    '轆轤師',
    '手ひねり',
    '玉作り',
    '型打ち',
    '型起こし',
    '石膏型',
    '押し型',
    '泥漿鋳込み',
    'スリップキャスト',
    '絵付師',
    '上絵付',
    '下絵付',
    '染付',
    '呉須',
    '五彩',
    '赤絵',
    '金襴手',
    '九谷焼',
    '有田焼',
    '伊万里焼',
    '瀬戸焼',
    '美濃焼',
    '常滑焼',
    '信楽焼',
    '備前焼',
    '萩焼',
    '清水焼',
    '京焼',
    '益子焼',
    '笠間焼',
    '小鹿田焼',
    '丹波立杭焼',
    '出西焼',
    '寿門焼',
    '琉球焼',
    '壺屋焼',
    '陶土',
    '粘土',
    '瓷土',
    '陶磁土',
    '練り土',
    '荒土',
    '化粧土',
    '化粧掛け',
    '釉薬',
    '灰釉',
    '長石釉',
    '石灰釉',
    '瑠璃釉',
    '織部釉',
    '志野釉',
    '天目釉',
    '油滴天目',
    '曜変天目',
    '結晶釉',
    '貫入釉',
    'マット釉',
    '釉下彩',
    '釉上彩',
    '焼成',
    '素焼き',
    '本焼き',
    '釉焼き',
    '還元焼成',
    '酸化焼成',
    '窯詰め',
    '穴窯',
    '登り窯',
    '連房式登り窯',
    '単室窯',
    '倒焔窯',
    'ガス窯',
    '電気窯',
    '灯油窯',
    '薪窯',
    '炭窯',
    'コークス窯',
    'ミニ窯',
    '試験窯',
    '温度計',
    '窯番',
    '火の番',
    '焼き番',
    '陶板',
    '陶板浴',
    '陶磁器製造',
    '日用陶器',
    '美術陶器',
    '茶陶',
    '花器',
    '食器',
    '器',
    '茶杯',
    '茶碗',
    '抹茶碗',
    '煎茶道具',
    '茶道具',
    '水指',
    '蓋置',
    '建水',
    '茶入',
    '茶杓',
    '釜',
    '風炉',
    '蹲踞',
    '香合',
    '香炉',
    '花入',
    '花生',
    '徳利',
    '盃',
    'ぐい呑み',
    '湯呑み',
    '土瓶',
    '急須',
    'ポット',
    '陶芸窯元',
    '窯元',
    '登り窯元',
    '陶芸教室',
    '陶芸体験',
    'ろくろ体験',
    '陶芸検定',
    '陶芸技能士'
  ];
  const negate = [
    'still awaiting the ceramicist license',
    'still awaiting the potter cert',
    'まだ焼成前',
    'まだ窯出し前',
    'これから焼成',
    'まだ開窯前'
  ];
  const nullPins = ['about to visit the kiln studio', 'about to file the firing report'];
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
