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
  // builder license granted & site supervisor certified
  'builder license granted', 'site supervisor certified',
];
const closeTabJa = [
  '建設業許可', '建設業者',
  '特定建設業', '一般建設業',
  '大臣許可', '知事許可',
  '建設業法', '下請負',
  '元請負', '主任技術者',
  '監理技術者', '建設業経理',
  '建設業登録', '施工体制台帳',
  '工事請負契約', '建設工事',
  '建設リサイクル法', '解体工事',
];
const negate = [
  'still awaiting the builder license',
  'まだ許可申請前', 'これから着工届',
];
const nullPins = [
  'about to file the construction notice', 'about to certify the supervisor',
];

describe('pass DXCIV: construction-industry license idioms (alphorn)', () => {
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
