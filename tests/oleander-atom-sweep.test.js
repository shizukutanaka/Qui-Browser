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
  'paid my share', 'collected the money',
  'settled up with everyone', 'receipt handed around',
  'tip left', 'bill folded',
  'table vacated', 'receipts photographed',
  'check split', 'check closed',
];
const closeTabJa = [
  '割り勘済み', '伝票をまとめて',
  '集金終了', '立て替えて',
  '請求書を撮って', '勘定が済んで',
  '二次会の会計',
];
const negate = [
  'still drinking', 'still at the table',
  'まだ飲んでる', 'まだ食事中',
];
const nullPins = [
  'about to pay the bill', 'mid dinner',
  'これから会計', '会計の途中',
  '伝票', '領収書',
];
const establishedPins = [
  ['split the check', 'close-tab'],
  ['cash out done', 'close-tab'],
  ['expense report filed', 'close-tab'],
  ['card swiped', 'close-tab'],
  ['paid by card', 'close-tab'],
  ['お会計を済ませて', 'close-tab'],
  ['領収書をもらって', 'close-tab'],
  ['カードで払って', 'close-tab'],
  ['現金で払って', 'close-tab'],
];

describe('pass CCCXCII: tab-settle & receipt wrap-up idioms (oleander)', () => {
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
