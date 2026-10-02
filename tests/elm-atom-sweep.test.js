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
  // ceremony end
  'graduation done', 'walked the stage',
  'tassel turned', 'cap tossed',
  'pomp over', 'commencement done',
  'dean called my name', 'ceremony over grad',
  // regalia & keepsakes
  'gown returned', 'awards collected',
  'yearbooks signed', 'alumni photos done',
  // after
  'grad party done', 'reception grad done',
  'last walk campus', 'valedictorian speech done',
  'graduated today',
];
const closeTabJa = [
  '式を終えて', '校歌を歌って',
  'ブローチを外して', '袴を脱いで',
  '記念撮影を済ませて', '謝恩会終了',
  '門をくぐって', '巣立って',
  'ガウンを返して', 'キャップを投げて',
  '式典を出て', '答辞を読んで',
  '祝辞が終わって', '証書をもらって',
  '写真を撮って卒業',
];
const negate = [
  'still at graduation', 'still in the ceremony',
  'まだ式中', 'まだ卒業式中',
];
const nullPins = [
  'about to graduate', 'mid ceremony',
  'diploma', 'yearbook', 'cap and gown',
  '式の途中', 'これから卒業式',
  '卒業証書', '寄せ書き',
];
const establishedPins = [
  ['diploma in hand', 'close-tab'],
  ['卒業式終了', 'close-tab'], ['学位記を受け取って', 'close-tab'],
  ['卒業しました', 'close-tab'], ['学位授与式終了', 'close-tab'],
  ['卒業証書を受け取って', 'close-tab'],
  ['graduation tomorrow', 'date'], ['明日卒業式', 'defer'],
];

describe('pass CCCLXXIX: graduation & commencement end idioms (elm)', () => {
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
