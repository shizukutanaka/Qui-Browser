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
  // glasses & hearing-aid purchase done
  'prescription updated', 'contacts ordered',
  'first contacts', 'hearing aids fitted',
  'batteries stocked', 'frames picked',
  'lenses replaced',
];
const closeTabJa = [
  'メガネを注文して', '新しいメガネを受け取って',
  '度数を測って', 'コンタクトを注文して',
  '初めてのコンタクトをして', '補聴器を合わせて',
  '電池を買って', 'フレームを選んで',
  'レンズを交換して', '保証を登録して',
];
const negate = [
  'still waiting for glasses', 'still adjusting',
  'まだメガネ待ち', 'まだ慣れてない',
];
const nullPins = [
  'about to get fitted', 'mid fitting',
  'eye exam', 'optician visit',
  'これから合わせる', 'フィッティング中',
  '視力検査', '眼鏡屋',
];
const establishedPins = [
  ['glasses ordered', 'close-tab'],
  ['new glasses', 'close-tab'],
  ['warranty registered', 'close-tab'],
];

describe('pass CDXXXIV: glasses & hearing-aid purchase idioms (nashi)', () => {
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
