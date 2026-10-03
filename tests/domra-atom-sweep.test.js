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
  // municipal grant approved & local assembly convened
  'municipal grant approved', 'local assembly convened',
];
const closeTabJa = [
  '地方自治法', '地方議会',
  '地方公務員', '地方交付税',
  '地方財政', '地方公営企業',
  '地域自治区', '道府県知事',
  '市町村長', '副知事',
  '助役', '収入役',
  '都道府県会', '市町村議会',
  '議会議員', '議会事務局',
  '条例制定', '規則制定',
  '行政処分', '行政不服審査',
  '行政手続', '住民訴訟提起',
  '住民監査', '住民請願',
  '陳情受理', '直接請求',
  '住民投票条例', '自治体連携',
  '広域連携', '一部事務組合',
  '地方公務員採用', '昇任試験',
  '人事委員会', '公平委員会',
];
const negate = [
  'still awaiting the local subsidy',
  'まだ条例制定前', 'これから請願',
];
const nullPins = [
  'about to file the ordinance petition',
  'about to join the regional union',
];
const establishedPins = [
  // already pinned close-tab — registered 住民訴訟提起/広域連携 instead
  ['住民訴訟', 'close-tab'],
  ['広域連合', 'close-tab'],
];

describe('pass DCXLVIII: local-government administration idioms (domra)', () => {
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
