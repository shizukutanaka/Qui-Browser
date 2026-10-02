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
  // national-pension exemption & deferment procedures done
  'pension exemption granted', 'student deferment filed',
  'back-payment done', 'waiver approved',
  'contribution receipt',
];
const closeTabJa = [
  '国民年金免除', '全額免除',
  '半額免除', '納付猶予',
  '学生納付特例', '追納',
  '保険料免除', '免除承認',
  '年金手帳', '第3号被保険者',
  '付加年金', '任意加入',
  '基礎年金番号', '滞納処分',
];
const negate = [
  'still on exemption', 'about to file the waiver',
  'まだ免除審査中', 'これから免除申請',
];
const nullPins = [
  'mid enrollment',
];
const establishedPins = [];

describe('pass DXII: national-pension exemption idioms (mokugyo)', () => {
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
