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
  // railway franchise granted & level crossing closed
  'railway franchise granted', 'level crossing closed',
];
const closeTabJa = [
  '鉄道事業法', '鉄道事業者',
  '鉄道運輸機構', '鉄道建設',
  '鉄道軌道', '線路設備',
  '駅施設', '鉄道信号',
  '列車運行', '運転保安',
  '鉄道事故', '鉄道監査',
  '踏切', '踏切事故',
  '鉄道免許', '鉄道営業',
  '旅客鉄道', '貨物鉄道',
  '新幹線', '在来線',
  '私鉄', '地下鉄',
  'モノレール', '路面電車',
  '軽便鉄道', '鉄道技術基準',
  '車両検査', '運転士',
  '車掌',
];
const negate = [
  'still awaiting the railway license',
  'まだ開業前', 'これから運行開始',
];
const nullPins = [
  'about to file the track plan',
  'about to certify the rolling stock',
];
const establishedPins = [
  // already pinned negate — registered まだ開業前/これから運行開始 instead
  ['まだ運行前', 'negate'],
];

describe('pass DCXLI: railway administration idioms (sackbut)', () => {
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
