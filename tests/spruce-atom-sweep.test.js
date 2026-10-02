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
  // pachinko / slots parlor
  'pachinko done', 'last ball spent',
  'slots done parlor', 'parlor emptied',
  'smoke cleared parlor',
  // mahjong
  'mahjong done', 'hanchan over',
  // bingo / lottery
  'keno done', 'bingo done',
  'lottery scratched',
  // horse racing / track
  'race over track', 'bet settled',
  'bookie paid', 'stable closed',
  'track done', 'paddock emptied',
  'last race done', 'day at the races done',
  'cashed the ticket', 'ticket cashed track',
  'winnings collected',
];
const closeTabJa = [
  'パチンコ終了', '出玉を流して',
  '景品を受け取って', '玉を流して',
  'スロット終了', '閉店パチンコ',
  '麻雀終了', '半荘終了',
  '競馬終了', '馬券を清算して',
  '払い戻しを受けて', 'パドックを出て',
  '賭けを終えて', 'ボート終了',
  '競輪終了', 'オート終了',
  'ラストレース終了', '館を出てパチンコ',
  'ホールを出て', '換金しました',
  '換金を済ませて', '軍資金を使い切って',
  '負けましたパチンコ', '勝ち逃げして',
];
const negate = [
  'still playing pachinko', 'still at the track',
  'まだパチンコ中', 'まだ麻雀中',
];
const nullPins = [
  'about to bet', 'mid hanchan',
  'pachinko balls', 'race card',
  'betting slip', 'keno card',
  'パチンコの途中', 'これからパチンコ',
  '馬券', '出玉',
];
const establishedPins = [
  ['parlor closed', 'close-tab'],
  ['track tomorrow', 'date'], ['明日競馬', 'defer'],
];

describe('pass CCCLXXV: pachinko & racetrack end idioms (spruce)', () => {
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
