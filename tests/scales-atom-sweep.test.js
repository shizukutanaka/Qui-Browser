const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

describe('pass DCCXI: detective-agency licensing (scales)', () => {
  const closeTab = [
    'investigator licensed', 'detective agency registered',
    'sleuth certified',
  ];
  const closeTabJa = [
    '探偵業', '探偵業法',
    '探偵', '探偵社',
    '探偵事務所', '興信所',
    '興信', '調査会社',
    '調査業', '私立探偵',
    '調査員', '調査報告',
    '調査報告書', '素行調査',
    '行動調査', '浮気調査',
    '不倫調査', '婚前調査',
    '結婚調査', '身辺調査',
    '信用調査', '企業調査',
    '雇用調査', '人事調査',
    '行方調査', '人探し',
    '所在調査', '家出人捜索',
    'ストーカー調査', 'いじめ調査',
    '盗聴器', '盗聴器発見',
    '盗撮', '尾行',
    '張り込み', '張込み',
    '聞き込み', '内偵',
    '覆面調査', '追跡調査',
    '証拠収集', '証拠写真',
    '撮影証拠', '調査機材',
    '監視機材', '暗視カメラ',
    '車両追尾', 'gps発信機',
    '依頼人', '依頼調査',
    '調査依頼', '調査契約',
    '見積もり調査', '調査料金',
    '成功報酬', '着手金',
    '探偵業届出', '届出証明書',
    '公安委員会届出', '営業所届出',
    '探偵業務', '重要事項説明',
    '契約書面', '秘密厳守',
    '守秘義務', '探偵協会',
    '調査業協会', '広告規制',
    '違法調査', '差別調査',
    '探偵免許', '調査力',
  ];
  const negate = [
    'still awaiting the investigator license',
    'まだ尾行中', 'まだ張り込み中',
  ];
  const nullPins = [
    'about to visit the detective agency',
    'about to file the investigation report',
  ];
  const establishedPins = [
    ['close this tab', 'close-tab'],
    ['keep it', 'negate'], ['leave it alone', 'negate'],
  ];

  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate)('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins)('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins)('"%s" -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
