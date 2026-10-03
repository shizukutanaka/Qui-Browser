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
  // drill end / all clear
  'drill over', 'all clear sounded', 'all clear given',
  'evacuation done', 'evacuated everyone',
  'roll called drill', 'muster point reached',
  'at the muster point',
  // drill types
  'fire drill over', 'shelter drill done',
  'lockdown drill done', 'shaker drill done',
  'duck and cover done', 'siren test done',
  'alarm test done',
  // gear / return
  'warden checked off', 'hard hats off drill',
  'helmets returned drill', 'back inside drill',
  'classes resumed', 'work resumed drill',
  // report / route
  'debrief done drill', 'logged the drill',
  'drill report filed', 'route walked drill',
  'exit route checked',
  // safety training
  'safety talk done', 'toolbox talk done',
  'cpr certified training', 'first aid training done',
  'aed training done', 'fire warden trained',
];
const closeTabJa = [
  '避難訓練終了', '訓練が終わって', '防災訓練終了',
  '避難完了', '避難を終えて',
  '点呼を取り終えて', '点呼が終わって',
  '避難所を出て', '警報が解除されて',
  '解除になって', '防災ずきんをしまって',
  'ヘルメットを返して',
  '教室に戻って訓練', '職場に戻って訓練',
  '消化訓練終了', '消火訓練終了',
  '消火器を置いて', '地震訓練終了',
  '津波訓練終了', '避難経路を確認して',
  '集合場所につきました', '班ごとに戻って',
  '救急救命終了', 'aed講習終了',
  '訓練の振り返りをして',
];
const negate = [
  'still in the drill', 'まだ訓練中',
];
const nullPins = [
  'about to drill', 'mid drill', 'evacuation route',
  'muster point', 'fire exit', 'emergency kit',
  '訓練の途中', 'これから訓練', '起動調整', '防災リュック',
];
const establishedPins = [
  ['drill done', 'close-tab'],
  ['headcount done', 'close-tab'],
  ['fire drill done', 'close-tab'],
  ['safety training done', 'close-tab'],
  ['ヘルメットを脱いで', 'close-tab'],
  ['救命講習終了', 'close-tab'],
  ['防火管理者講習終了', 'close-tab'],
  ['drill tomorrow', 'date'], ['明日訓練', 'defer'],
];

describe('pass CCCLXVII: drill & evacuation end idioms (palm)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
