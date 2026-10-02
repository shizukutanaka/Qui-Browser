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
  // campaign & election-night end
  'campaign over', 'election day over',
  'polls done', 'ballot counted',
  'won the seat', 'lost the race',
  'victory speech given',
  // post-campaign teardown
  'rallied out', 'canvassing done',
  'signs taken down', 'campaign office closed',
  'rallies all done', 'final rally done',
];
const closeTabJa = [
  '投票日終了', '開票速報終了',
  '落選しました', '敗戦宣言',
  '勝利宣言', '勝利演説終了',
  '街頭演説終了', '演説会終了',
  '選挙カーを納めて', '看板を外して',
  '事務所を畳んで',
];
const negate = [
  'still campaigning', 'still on the trail',
  'まだ応援中',
];
const nullPins = [
  'about to vote', 'mid campaign',
  'campaign flyer', 'ballot box',
  'これから投票', '選挙の途中',
  '選挙ポスター', '投票箱',
];
const establishedPins = [
  ['conceded the race', 'close-tab'],
  ['concession speech given', 'close-tab'],
  ['election night over', 'close-tab'],
  ['選挙戦終了', 'close-tab'],
  ['当選確実', 'close-tab'],
  ['敗北を認めて', 'close-tab'],
  ['まだ選挙中', 'negate'],
];

describe('pass CCCXCVI: campaign & election-night end idioms (saxifrage)', () => {
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
