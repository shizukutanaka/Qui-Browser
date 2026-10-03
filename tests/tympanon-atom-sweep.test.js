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
  // welfare equipment rented & home ramp funded
  'welfare equipment rented', 'home ramp funded',
];
const closeTabJa = [
  '福祉用具貸与', '福祉用具購入',
  '住宅改修', '手すり設置',
  '段差解消', '介護保険住宅改修',
  '福祉用具レンタル', '車いす貸与',
  '介護ベッド', '移動用リフト',
  '歩行器', '補装具',
  '補装具費支給', '日常生活用具',
  '障害者用具', '給付券',
  '福祉用具専門相談員', 'スロープ設置',
];
const negate = [
  'still awaiting the equipment loan',
  'まだ貸与前', 'これから改修申請',
];
const nullPins = [
  'about to apply for the ramp grant', 'about to rent the wheelchair',
];

describe('pass DXCVII: welfare-equipment & home-modification idioms (tympanon)', () => {
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
