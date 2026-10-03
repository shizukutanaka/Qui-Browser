// pass DCCXII: secondhand-goods & pawnshop licensing -> close-tab
// (EN dealer/pawnshop/resale forms + JA 古物営業・質屋・中古買取・リユース・遺品整理・骨董・盗品規制)
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const t1 = { id: 1, url: 'https://a.example', title: 'Tab A', loading: false };
  const t2 = { id: 2, url: 'https://b.example', title: 'Tab B', loading: false };
  const vc = new VoiceCommands({
    speak: () => {},
    onCommand: () => {},
  });
  vc.connectBrowser({
    getActiveTab: () => t1,
    closeTab: () => {},
    tabs: () => [t1, t2],
  });
  return vc;
}

const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

describe('pass DCCXII: secondhand-goods & pawnshop licensing (annulet)', () => {
  const closeTab = [
    'pawnshop licensed', 'dealer registered', 'resale shop certified',
  ];
  const closeTabJa = [
    '古物商', '古物営業法', '古物営業', '古物', '古物台帳', '古物競り市場', '古物市場',
    '質屋', '質屋営業法', '質業', '質料', '質入れ', '質札', '質草',
    '受戻し', '受け戻し', '質預かり', '七つ屋', 'しちや',
    'リサイクルショップ', '中古品', '中古店', '中古販売', '中古買取',
    '買取店', '買取査定', '買取価格', '買取業者', 'ブランド買取',
    '金券ショップ', 'チケットショップ', '貴金属買取', '金買取', 'プラチナ買取',
    'リユース', 'リユース業', '古着販売', '古書店', '古本屋',
    '中古車販売', '中古車買取', '中古車査定', '中古車販売店',
    'オークション代行', 'フリマアプリ出品',
    '遺品整理', '遺品整理業', '生前整理', '片付け業者', '便利屋',
    '金属くず商', '屑物商', '廃品回収', '廃品回収業', '資源回収',
    '家電リサイクル', 'リサイクル料金', '産業廃棄物収集', '自動車リサイクル',
    '小型家電回収', '仏壇処分',
    '骨董商', '美術品商', '絵画販売', '掛け軸', '刀剣商', '古美術',
    '盗品', '盗難品', '盗品等売買', '盗品譲受',
    '本人確認', '身分証確認', '行商従業者', '露店営業', '行商', '換金',
  ];
  const negate = [
    'still awaiting the dealer license',
    'still awaiting the pawnshop permit',
    'まだ買取前', 'これから査定', 'まだ営業前',
  ];
  const nullPins = [
    'about to visit the pawnshop',
    'about to file the dealer notice',
  ];
  const establishedPins = [
    ['質流れ', 'close-tab'], ['骨董品', 'close-tab'],
    ['close this tab', 'close-tab'],
    ['keep it', 'negate'], ['leave it alone', 'negate'],
  ];

  let vc;
  beforeEach(() => { vc = makeVC(); });

  closeTab.forEach(p =>
    test(`close-tab: "${p}"`, () => expect(key(vc, p)).toBe('close-tab')));
  closeTabJa.forEach(p =>
    test(`close-tab JA: ${p}`, () => expect(key(vc, p)).toBe('close-tab')));
  negate.forEach(p =>
    test(`negate: "${p}"`, () => expect(key(vc, p)).toBe('negate')));
  nullPins.forEach(p =>
    test(`still null: "${p}"`, () => expect(key(vc, p)).toBeNull()));
  establishedPins.forEach(([p, k]) =>
    test(`pin: "${p}" still -> ${k}`, () => expect(key(vc, p)).toBe(k)));
});
