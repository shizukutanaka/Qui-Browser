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
  // gas retail permit granted & pipeline safety officer appointed
  'gas retail permit granted', 'pipeline safety officer appointed',
];
const closeTabJa = [
  'ガス事業法', 'ガス小売事業',
  'ガス導管事業', 'ガス工作物',
  'ガス主任技術者', 'ガス料金規則',
  '都市ガス', '簡易ガス',
  '高圧ガス保安法', 'lpガス販売',
  '液化石油ガス法', 'ガス消費機器',
  '保安業務', 'ガス供給条件',
  'ガス工事業', 'ガス器具設置',
  'ガス栓増設', 'ガス埋設管',
  'ガス漏洩検査', '熱供給事業',
  '地域熱供給', 'ガス導管維持管理',
  'ガス事故報告',
];
const negate = [
  'still awaiting the gas permit',
  'まだ供給申請前', 'これから導管届',
];
const nullPins = [
  'about to file the gas tariff',
  'about to join the heating co-op',
  // 'プロパンガス' — zither (CDLXXI) pins it null
  'プロパンガス',
];

describe('pass DCXXVII: gas & district-heating administration idioms (dvojnice)', () => {
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
