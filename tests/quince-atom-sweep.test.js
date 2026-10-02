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
  // long-holiday aftermath
  'back at the grind', 'holiday blues gone',
  'unpacked the souvenirs', 'thank you gifts handed out',
  'vacation photos uploaded', 'out of office off',
  'autoresponder off', 'back in the routine',
  'caught up on sleep', 'recovered from jet lag',
  'golden week done', 'vacation done and dusted',
];
const closeTabJa = [
  'お盆明け', '休みが終わって',
  '不在通知を切って', '旅の疲れを取って',
  '連休が明けて', '休暇明け',
  '土産話が終わって', '旅の写真を整理して',
];
const negate = [
  'still away', 'still on break',
  'まだ休み中',
];
const nullPins = [
  'about to return to work', 'mid vacation',
  'souvenirs', 'omiyage',
  'これから出勤', '休みの途中',
  '土産物',
];
const establishedPins = [
  ['still on vacation', 'negate'],
  ['まだ旅行中', 'negate'],
  ['ゴールデンウィーク終了', 'close-tab'],
  ['連休明け', 'close-tab'],
  ['正月明け', 'close-tab'],
  ['土産を配って', 'close-tab'],
  ['お土産を渡して', 'close-tab'],
  ['日常に戻って', 'close-tab'],
  ['時差ボケが治って', 'close-tab'],
];

describe('pass CCCXCIV: long-holiday aftermath & return-to-routine idioms (quince)', () => {
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
