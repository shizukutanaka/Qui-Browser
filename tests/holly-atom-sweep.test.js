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
  // performance & encore
  'performance over', 'encore played',
  'played my last note', 'piece played through',
  'program finished',
  // stage wrap
  'stage emptied', 'music stand folded',
  'instrument cased', 'hall emptied out',
  // ensembles
  'orchestra concert done', 'choir sang last note',
  'conservatory recital done', 'solo nailed',
  'festival set done', 'concert done',
  'gig wrapped', 'set finished',
];
const closeTabJa = [
  'アンコールを終えて', '拍手が止んで',
  '舞台を出て', '舞台袖に入って',
  '合唱終了', '合奏終了',
  '吹奏楽終了', '部の発表終了',
  '音楽会終了', 'ステージを降りて',
  '舞台を降りて', 'コンクール終了',
  '演奏を終えて', '楽器をケースに',
  '残響が消えて', '本番が終わって',
  '演奏し終えて',
];
const negate = [
  'still performing', 'still on stage',
  'まだ演奏中', 'まだリハーサル中',
];
const nullPins = [
  'about to perform', 'mid concerto',
  'sheet music', 'recital program', 'concert hall',
  '演奏の途中', 'これから演奏',
  '楽譜', 'プログラム',
];
const establishedPins = [
  ['recital done', 'close-tab'], ['bowed out', 'close-tab'],
  ['applause faded', 'close-tab'], ['curtain call done', 'close-tab'],
  ['発表会終了', 'close-tab'], ['演奏会終了', 'close-tab'],
  ['カーテンコール終了', 'close-tab'], ['譜面台を畳んで', 'close-tab'],
  ['おさらい会終了', 'close-tab'],
  ['concert tomorrow', 'date'], ['明日演奏会', 'defer'],
];

describe('pass CCCLXXVIII: recital & performance end idioms (holly)', () => {
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
