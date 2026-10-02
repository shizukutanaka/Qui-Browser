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
  // send-off organizer side done
  'farewell card signed', 'message card passed',
  'bouquet ordered', 'sendoff speech done',
  'saw them off', 'handed over duties',
  'goodbye email sent',
];
const closeTabJa = [
  'メッセージカードを回して', '寄せ書きを渡して',
  '花束を用意して', '送別の挨拶をして',
  '引き継ぎを終えて', 'お別れメールを送って',
];
const negate = [
  'still collecting signatures', 'still planning the sendoff',
  'まだ寄せ書き集め中', 'まだ送別会の準備中',
];
const nullPins = [
  'about to say goodbye', 'mid sendoff',
  'farewell card', 'handover notes',
  'もうすぐお別れ', '送別の途中',
  '寄せ書き', '引き継ぎ資料',
];
const establishedPins = [
  ['farewell lunch done', 'close-tab'],
  ['見送って', 'close-tab'],
  ['机を片付けて', 'close-tab'],
  ['連絡先を交換して', 'close-tab'],
  ['送別ランチに行って', 'go-to'],
];

describe('pass CDXXX: send-off & farewell organizer idioms (ugli)', () => {
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
