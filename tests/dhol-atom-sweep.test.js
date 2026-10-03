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
  // mining permit granted & claim staked
  'mining permit granted', 'claim staked',
];
const closeTabJa = [
  '鉱業法', '鉱区設定',
  '鉱業権', '採掘権',
  '鉱業権申請', '鉱山閉山',
  '鉱害防止', '鉱山保安',
  '鉱業審議会', '鉱害賠償',
  '鉱業税', '試掘権',
  '採掘技術', '石炭鉱山',
  '金属鉱山', '鉱業登録',
  '鉱業監督', '鉱山労働',
  '採掘計画', '鉱量',
  '砂利採取', '鉱業等租税',
  '鉱業適格', '採掘権者',
];
const negate = [
  'still awaiting the mining permit',
  'まだ採掘前', 'これから鉱区申請',
];
const nullPins = [
  'about to file the mining claim',
  'about to close the shaft',
];

describe('pass DCXXX: mining industry administration idioms (dhol)', () => {
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
