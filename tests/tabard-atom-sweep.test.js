// pass DCCXIV: laundry & manual-therapy licensing -> close-tab
// (EN laundry/dry-cleaner forms + JA クリーニング業・洗濯・あん摩鍼灸・柔整・施術届出)
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

describe('pass DCCXIV: laundry & manual-therapy licensing (tabard)', () => {
  const closeTab = ['laundry licensed', 'dry cleaner registered', 'pressing shop certified'];
  const closeTabJa = [
    'クリーニング',
    'クリーニング業',
    'クリーニング業法',
    'クリーニング師',
    'クリーニング所',
    'クリーニング店',
    'ドライクリーニング',
    'ランドリー',
    'コインランドリー',
    '宅配クリーニング',
    '洗濯物',
    '洗濯代行',
    '洗濯工場',
    '洗たく',
    '洗い張り',
    'しみ抜き',
    '染み抜き',
    'プレス',
    'アイロン',
    '集配',
    '衣類洗濯',
    'ウェットクリーニング',
    '溶剤',
    '有機溶剤',
    '洗濯表示',
    '毛布クリーニング',
    '布団クリーニング',
    'カーテンクリーニング',
    '皮革クリーニング',
    '洗濯タグ',
    '合成洗剤',
    '洗剤',
    '石鹸',
    '漂白剤',
    '柔軟剤',
    '漂白',
    '脱水',
    '乾燥機',
    '乾燥',
    '洗濯機',
    '洗濯槽',
    'マッサージ',
    'あん摩',
    'あん摩マッサージ指圧師',
    '指圧',
    '指圧師',
    '按摩',
    '鍼',
    'はり',
    'はり師',
    '鍼師',
    '鍼灸',
    '鍼灸師',
    '鍼灸院',
    '灸',
    'きゅう',
    'きゅう師',
    '柔道整復',
    '柔道整復師',
    '柔整',
    '接骨院',
    '整骨院',
    '整復',
    '整体',
    '整体院',
    'カイロプラクティック',
    'リラクゼーション',
    '揉みほぐし',
    '治療院',
    '施術所',
    '施術者',
    '医業類似行為',
    '無免許',
    '開設届',
    '開設届出',
    '施術料',
    '施術料金',
    '治療効果',
    '養成学校',
    '症状'
  ];
  const negate = [
    'still awaiting the laundry license',
    'still awaiting the massage license',
    'まだ洗濯中',
    'まだ乾燥前',
    'まだ施術中'
  ];
  const nullPins = ['about to visit the laundromat', 'about to file the massage notice'];
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
