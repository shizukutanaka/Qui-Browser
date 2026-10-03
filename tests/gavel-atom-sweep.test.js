const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

describe('pass DCCX: security-guard industry licensing (gavel)', () => {
  const closeTab = [
    'guard licensed', 'patrol certified', 'security firm registered',
  ];
  const closeTabJa = [
    '警備業法', '警備業',
    '警備', '警備員',
    '警備会社', '警備業者',
    '警備業務', '警備保障',
    'セキュリティ会社', 'セキュリティ',
    'ガードマン', '警備保障会社',
    '警備局', '警備本部',
    '警備主任', '警備員指導教育責任者',
    '機械警備', '機械警備業務',
    '常駐警備', '巡回警備',
    '交通誘導警備', '駐車場警備',
    '施設警備', 'イベント警備',
    '雑踏警備', '貴重品運搬警備',
    '現金輸送', '身辺警備',
    '要人警護', '警護',
    '警護対象', 'sp',
    '空港保安警備', '保安検査',
    '手荷物検査', '金属探知機',
    '警備計画', '警備実施計画',
    '警戒員', '監視員',
    '監視カメラ', 'センサー警報',
    '侵入警報', '異常発生',
    '通報受信', '管制センター',
    '警備管制', '警備指令',
    '警備待機', '制服貸与',
    '警備服', '警棒',
    '誘導灯', '警笛',
    '盾', '防護服',
    '警備教育', '警備員教育',
    '新任研修', '現任研修',
    '警備員検定', '警備業務検定',
    '警備員資格', '警備業認定',
    '届出警備業', '警備業開始届',
    '認定警備業', '公安委員会指定',
    '待機確認', '警備料金',
    '警備契約', '警備受注',
    '契約警備', '警備日報',
    '事故報告', '接触事故',
    '苦情処理',
  ];
  const negate = [
    'still awaiting the guard license',
    'still awaiting the security review',
    'まだ警備前', 'これから警備',
  ];
  const nullPins = [
    'about to visit the guard office',
    'about to file the security report',
  ];
  const establishedPins = [
    ['警備部', 'close-tab'], ['警戒レベル', 'close-tab'],
    ['防犯カメラ', 'close-tab'],
    ['まだ警戒中', 'negate'], ['まだ巡回中', 'negate'],
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
