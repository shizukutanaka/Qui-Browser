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
  // septic tank installed & pump-out scheduled
  'septic tank installed', 'pump-out scheduled',
];
const closeTabJa = [
  '汲取り', '浄化槽設置',
  '浄化槽維持管理', '浄化槽点検',
  '浄化槽清掃', '法定検査',
  '浄化槽使用廃止', '合併処理浄化槽',
  '単独処理浄化槽', '転換補助金',
  '汲取料金', 'し尿処理',
  '家庭系ごみ', '生活排水',
  '下水道使用料', '下水道接続',
];
const negate = [
  'still on a septic tank',
  'まだ接続前', 'これから設置申請',
];
const nullPins = [
  'about to hook up to the sewer', 'about to schedule a pump-out',
];

describe('pass DLXXVII: septic-tank & sewer-connection idioms (bongo)', () => {
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
