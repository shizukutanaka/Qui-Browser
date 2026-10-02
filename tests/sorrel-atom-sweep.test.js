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
  // school-event end
  'class visit done', 'observation day done',
  'parent teacher conference done',
  'field day done', 'field trip over',
  'school festival done',
  'pta meeting done', 'chaperone shift done',
  'handed in the form', 'lunch duty done',
];
const closeTabJa = [
  '授業参観終了', '懇談会終了',
  '遠足終了', '校外学習終了',
  'pta総会終了', '役員仕事終了',
  'お迎え終了', '連絡帳を出して',
  '提出物を出して', '昼食当番終了',
];
const negate = [
  'still at the school event', 'still at pickup',
  'まだ学校行事中', 'まだお迎え中',
];
const nullPins = [
  'about to visit the class', 'mid field trip',
  'school newsletter', 'pta dues',
  '行事の途中', 'これから参観',
  'お便り', '会費',
];
const establishedPins = [
  ['sports day done', 'close-tab'], ['excursion done', 'close-tab'],
  ['culture festival done', 'close-tab'], ['pickup done', 'close-tab'],
  ['kids picked up', 'close-tab'], ['permission slip signed', 'close-tab'],
  ['参観日終了', 'close-tab'], ['三者面談終了', 'close-tab'],
  ['運動会終了', 'close-tab'], ['体育祭終了', 'close-tab'],
  ['文化祭終了', 'close-tab'], ['学園祭終了', 'close-tab'],
  ['バザー終了', 'close-tab'], ['保護者会終了', 'close-tab'],
  ['open house done', 'go-to'],
  ['school event tomorrow', 'date'], ['明日参観日', 'defer'],
];

describe('pass CCCLXXXIV: school-event & PTA end idioms (sorrel)', () => {
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
