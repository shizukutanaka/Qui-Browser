const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ id: 1 }),
    closeTab: () => {},
    tabs: () => [],
  });
  return vc;
}
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  // broadcast license granted & spectrum fee paid
  'broadcast license granted', 'spectrum fee paid',
];
const closeTabJa = [
  '電気通信事業法', '総務省',
  '電波法', '電波利用料',
  '基地局', '鉄塔事業',
  'ユニバーサルサービス', '番号ポータビリティ',
  '携帯番号転出', '光回線',
  '通信秘密', '放送法',
  '放送局免許', '放送大学',
  '緊急告知fm', '地上波デジタル',
  '中継局', '衛星放送',
  'ケーブルテレビ', 'コミュニティ放送',
  'サイマル放送', '報道機関',
  '電波監理審査会', '電波監査官',
  '電波標準審査会', '周波数割当',
  '無線局免許',
];
const negate = [
  'still awaiting the broadcast license',
  'まだ免許申請前', 'これから放送届',
];
const nullPins = [
  'about to file the carrier application',
  'about to renew the spectrum permit',
];
const establishedPins = [
  ['nhk受信料免除', 'close-tab'],
];

describe('pass DCXXV: telecom & broadcasting administration idioms (piwang)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa)('"%s" -> close-tab (ja)', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate)('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins)('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
