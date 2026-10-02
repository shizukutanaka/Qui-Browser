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
  // funeral arrangement done (喪主・手配側の終了)
  'funeral arranged', 'coffin chosen',
  'cemetery plot bought', 'obituary posted',
  'mourners notified', 'wake room booked',
  'shrine contacted', 'memorial done',
];
const closeTabJa = [
  '葬儀を手配して', '棺を選んで',
  '墓石を建てて', '会葬者に連絡して',
  '通夜の席を取って', '戒名をもらって',
  '香典を数えて', '納骨を済ませて',
];
const negate = [
  'still arranging the funeral', 'about to arrange',
  'まだ葬儀手配中', 'これから手配する',
];
const nullPins = [
  'mid arrangements', 'funeral prep', 'wake prep',
  '手配中', '葬儀の準備', '通夜の準備',
];
const establishedPins = [
  ['donations counted', 'close-tab'],
  ['ashes interred', 'close-tab'],
  ['法要を終えて', 'close-tab'],
  ['訃報を知らせて', 'web-search'],
];

describe('pass CDXLIII: funeral arrangement idioms (xcxa)', () => {
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
