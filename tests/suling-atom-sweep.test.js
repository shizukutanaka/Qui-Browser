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
  // heritage survey done & dig permit granted
  'heritage survey done', 'dig permit granted',
];
const closeTabJa = [
  '文化財', '史跡',
  '重要文化財', '登録有形文化財',
  '保護計画', '博物館',
  '郷土資料館', '埋蔵文化財',
  '発掘調査', '史跡整備',
  '文化財審議会', '現状変更',
  '保存活用', '指定文化財',
  '建造物保存', '伝統的建造物群',
  '重伝建', '活用促進',
];
const negate = [
  'still awaiting the excavation',
  'まだ発掘前', 'これから調査',
];
const nullPins = [
  'about to dig the site', 'about to file a survey',
];

describe('pass DLXXXV: cultural-heritage & excavation idioms (suling)', () => {
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
