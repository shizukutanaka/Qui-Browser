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
  // storm over
  'rain stopped', 'storm passed',
  'typhoon gone', 'sun came out',
  'cleared up', 'rainbow out',
  // brought in / closed up
  'brought the laundry in', 'laundry taken in',
  'futon aired', 'shoes dried',
  'umbrella closed', 'windows closed',
  'shutters down', 'storm shutters up',
  'typhoon prep done', 'came inside',
  'clothesline emptied',
];
const closeTabJa = [
  '雨がやんで', '雷雨が去って',
  '台風が去って', '晴れてきて',
  '虹が出て',
  '靴を乾かして', '傘を閉じて',
  '窓を閉めて', '雨戸を閉めて',
  '台風対策終了', '家に入って',
  '物干し竿をしまって',
];
const negate = [
  'still raining', 'still storming',
  'まだ降ってる', 'まだ嵐',
];
const nullPins = [
  'about to rain', 'mid typhoon',
  'rain gear', 'weather forecast',
  'laundry still out',
  'もうすぐ雨', '暴風の途中',
  '雨具', '天気予報',
  '洗濯物がまだ',
];
const establishedPins = [
  ['洗濯物を取り込んで', 'close-tab'],
  ['布団を干して', 'close-tab'],
  ['シャッターを閉めて', 'close-tab'],
];

describe('pass CCCLXXXVII: storm-over & laundry-in idioms (vervain)', () => {
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
