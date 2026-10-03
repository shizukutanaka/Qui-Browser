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
  // traffic violation ticketed & arrest warrant issued
  'traffic violation ticketed', 'arrest warrant issued',
];
const closeTabJa = [
  '警察庁', '警察法',
  '警視庁', '道府県警察',
  '警察署', '派出所',
  '移動交番', '警察官',
  '巡査', '警部',
  '公安委員会', '警察本部',
  '刑事', '捜査本部',
  '職務質問', '交通課',
  '生活安全課', '地域課',
  '機動隊', '警察署長',
  '巡査部長', '警察官採用',
  '警察学校', '警察官試験',
  '警備部', '捜査一課',
];
const negate = [
  'still awaiting the police report',
  'まだ通報前', 'これから被害届',
];
const nullPins = [
  'about to file the police report',
  'about to visit the precinct',
];
const establishedPins = [
  // already pinned close-tab — registered 派出所/移動交番 instead of 交番/駐在所
  ['police report filed', 'close-tab'],
  ['交番', 'close-tab'],
  ['駐在所', 'close-tab'],
  // already pinned negate — registered まだ通報前/これから被害届 instead
  ['まだ届出前', 'negate'],
  ['これから届出', 'negate'],
  ['まだ被害届前', 'negate'],
];

describe('pass DCXXXVII: police & public-safety administration idioms (vihuela)', () => {
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
