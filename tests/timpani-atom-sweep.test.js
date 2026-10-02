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
  // handicap discount granted & welfare fare issued
  'handicap discount granted', 'welfare fare issued',
];
const closeTabJa = [
  'nhk受信料免除', '放送受信料減免',
  '携帯料金割引', '公共施設割引',
  '障害者駐車場', '障害者駐車許可',
  '福祉料金', '軽自動車税減免',
  '自動車税軽減', '高速道路割引',
  '航空運賃割引', '鉄道割引',
  'タクシー券', '福祉乗車証',
  '介護保険負担減額', '減免申請',
];
const negate = [
  'still not eligible',
  'まだ減免前', 'これから割引申請',
];
const nullPins = [
  'about to claim the exemption', 'about to apply for the discount',
];

describe('pass DLXXV: disability-discount & exemption idioms (timpani)', () => {
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
