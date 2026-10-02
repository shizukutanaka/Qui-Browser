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
  // moving-in-together & roommate setup
  'moved in together', 'started living together',
  'roommate moved in', 'found a roommate',
  'house rules set', 'chores divided',
  'rent split done', 'shared space set up',
  'met the roommate', 'roommate interview done',
  'cohabiting started', 'moved in with partner',
];
const closeTabJa = [
  '同棲を始めて', '同居を始めて',
  'ルームメイトが入って', 'ルームメイトを決めて',
  'ルールを決めて', '家事分担を決めて',
  '家賃を折半して', '共有スペースを整えて',
  '同居人に会って', '面談をして',
  'シェアハウスに入って', '二人暮らしを始めて',
];
const negate = [
  'still looking for a roommate',
  'まだルームメイト探し中', 'まだ調整中',
];
const nullPins = [
  'about to move in together', 'mid roommate search',
  'chore chart', 'house rules',
  'これから同居', '面談の途中',
  '家事分担表', 'ハウスルール',
];
const establishedPins = [
  ['still interviewing', 'negate'],
];

describe('pass CDVII: roommate & cohabiting idioms (radish)', () => {
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
