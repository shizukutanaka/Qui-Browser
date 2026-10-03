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
  // community bus launched & demand transit approved
  'community bus launched', 'demand transit approved',
];
const closeTabJa = [
  'コミュニティバス', 'デマンド交通',
  '乗合タクシー', '生活交通',
  '公共交通空白地', '運行協議会',
  '地域公共交通計画', 'バス路線廃止',
  '代替交通', '乗継割引',
  'バス停設置', '路線バス',
  '鉄道代替バス', 'フィーダーバス',
  '公共交通活性化', '地域公共交通確保',
  '生活バス', '循環バス',
];
const negate = [
  'still awaiting the bus route',
  'まだ運行前', 'これから運行申請',
];
const nullPins = [
  'about to launch the community bus', 'about to request the shuttle',
];

describe('pass DCII: community-transit & bus-route idioms (cornett)', () => {
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
});
