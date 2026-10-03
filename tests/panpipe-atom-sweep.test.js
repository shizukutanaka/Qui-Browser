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
  // harbor notice filed & pilot boarded
  'harbor notice filed', 'pilot boarded',
];
const closeTabJa = [
  '海上保安庁', '海難',
  '港務所', '入港届',
  '出港届', '船舶交通',
  '灯台', '航路標識',
  '水路測量', '港湾計画',
  '防波堤', '岸壁',
  '港湾管理者', '港湾区域',
  '港湾利用料', '海上交通安全法',
  '海難審判', '水先人',
];
const negate = [
  'still awaiting the port clearance',
  'まだ入港前', 'これから入港届',
];
const nullPins = [
  'about to dock the ship', 'about to file the harbor notice',
];

describe('pass DLXXXVIII: harbor-admin & maritime-safety idioms (panpipe)', () => {
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
