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
  // wake & service
  'wake over', 'viewing done',
  'paid my respects', 'signed the guest book',
  'offered incense', 'funeral attended',
  'memorial attended', 'condolences given',
  'brought the offering', 'sat with the family',
  // procession & wrap
  'drove in the procession', 'seen them off',
  'back from the funeral',
  'removed the armband', 'changed out of black',
];
const closeTabJa = [
  '通夜終了', '告別式終了',
  '焼香して', 'お悔やみを述べて',
  '香典を渡して', '記帳して',
  '喪主を務めて', '葬列が終わって',
  '葬儀から帰って', '忌引きが明けて',
  '喪服を脱いで', '礼服を畳んで',
  '喪中が明けて',
];
const negate = [
  'still at the wake', 'still in mourning',
  'まだ通夜中', 'まだ弔問中',
];
const nullPins = [
  'about to pay respects', 'mid wake',
  'funeral notice', 'mourning clothes',
  'これから焼香', '通夜の途中',
  '訃報', '喪服',
];
const establishedPins = [
  ['お見送りして', 'close-tab'],
];

describe('pass CCCXCI: wake & funeral-attendance end idioms (nerine)', () => {
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
