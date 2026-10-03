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
  // architect registered & design office licensed
  'architect registered', 'design office licensed',
];
const closeTabJa = [
  '建築士', '一級建築士',
  '二級建築士', '木造建築士',
  '建築士事務所', '設計事務所登録',
  '管理建築士', '構造設計一級建築士',
  '設備設計一級建築士', '建築士会',
  '建築士事務所協会', '設計審査',
  '意匠設計', '構造計算適合性判定',
  '構造設計', '設備設計',
  '性能評価', '建築士試験',
  '建築士登録', '建築士免許',
  '設計者', '監理業務',
];
const negate = [
  'still awaiting the architect registration',
  'まだ登録申請前', 'これから設計申請',
];
const nullPins = [
  'about to register the design office', 'about to sit the architect exam',
];
const establishedPins = [
  ['設計事務所', 'close-tab'],
  ['構造計算', 'close-tab'],
];

describe('pass DCV: architect registration & design-office idioms (bawu)', () => {
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
  test.each(establishedPins)('pinned "%s" stays "%s"', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
