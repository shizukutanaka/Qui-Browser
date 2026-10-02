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
  // e-Tax / electronic filing transmitted (電子申告の終了側)
  'etax submitted', 'mynaportal linked',
  'card reader paired', 'e filing done',
  'acceptance number issued', 'refund scheduled',
  'electronic filing', 'tax return sent',
  'submission accepted',
];
const closeTabJa = [
  'e-tax送信', 'マイナポータル',
  'icカードリーダー', '電子申告',
  '受付番号が出て', '還付予定',
  '送信済み', '申告書を送信して',
  'マイナカードを読んで', 'スマホ申告',
];
const negate = [
  'still transmitting', 'about to transmit',
  'まだ送信中', 'これから送信',
];
const nullPins = [
  'mid transmission',
];

describe('pass CDLXXIX: e-Tax electronic filing idioms (sitar)', () => {
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
});
