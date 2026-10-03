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
  // verdict handed down & court session adjourned
  'verdict handed down', 'court session adjourned',
];
const closeTabJa = [
  '司法試験', '法曹三者',
  '裁判員制度', '検察庁',
  '検事総長', '最高裁判所',
  '高等裁判所', '地方裁判所',
  '簡易裁判所', '地方検察庁',
  '少年審判', '民事調停',
  '調停委員', '司法委員会',
  '裁判書記官', '執行官',
  '司法修習', '判例集',
  '検事', '判事',
  '控訴審', '判決宣告',
  '刑事裁判', '訴訟費用',
  '訴訟記録', '判示事項',
];
const negate = [
  'still awaiting the verdict',
  'まだ判決前', 'これから控訴',
];
const nullPins = [
  'about to file the appeal',
  'about to convene the jury',
];
const establishedPins = [
  // '家庭裁判所' already pinned close-tab — registered '地方検察庁' instead
  ['家庭裁判所', 'close-tab'],
];

describe('pass DCXXXII: judiciary & court administration idioms (bendir)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
