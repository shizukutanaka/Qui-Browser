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
  // imperial succession proclaimed & palace ceremony held
  'imperial succession proclaimed', 'palace ceremony held',
];
const closeTabJa = [
  '宮内庁', '宮内庁長官',
  '皇室', '皇室費用',
  '内廷費', '宮廷費',
  '皇族', '皇室活動',
  '国事行為', '皇室典範',
  '皇位継承', '即位',
  '退位', '大喪',
  '立皇嗣', '上皇',
  '皇太子', '元号',
  '改元', '年号',
  '国喪', '式部官',
  '親王', '内親王',
  '皇宮', '宮殿',
  '皇室会議', '皇族会議',
  '皇統', '皇位継承順位',
  '宮内庁式部', '宮内官',
  '皇室医務', '宮内庁侍従',
];
const negate = [
  'still awaiting the palace ceremony',
  'まだ即位前', 'これから行幸',
  'まだ叙位前',
];
const nullPins = [
  'about to file the succession report',
  'about to attend the imperial ceremony',
];

describe('pass DCLII: imperial household administration idioms (posthorn)', () => {
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
