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
  // baby-gear & hospital prep done
  'stroller bought', 'baby clothes washed',
  'diapers stocked', 'nursery set up',
  'hospital bag packed', 'maternity leave started',
  'baby registry done',
];
const closeTabJa = [
  'ベビーベッドを組み立てて', 'ベビーカーを買って',
  'チャイルドシートを付けて', 'ベビー服を洗って',
  'おむつを買い置きして', '哺乳瓶を消毒して',
  'ベビールームを整えて', '入院バッグを用意して',
  '産休に入って', '出産準備リストを終えて',
];
const negate = [
  'still shopping for baby', 'still expecting',
  'まだ買い足し中',
];
const nullPins = [
  'about to set up the nursery', 'mid setup',
  'baby gear', 'due date',
  'これから準備する', '準備中',
  'ベビー用品', '出産予定日',
];
const establishedPins = [
  ['crib assembled', 'close-tab'],
  ['car seat installed', 'close-tab'],
  ['bottles sterilized', 'close-tab'],
  ['まだ妊娠中', 'negate'],
];

describe('pass CDXL: baby-gear & hospital prep idioms (udon)', () => {
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
