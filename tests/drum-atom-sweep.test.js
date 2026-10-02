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
  // mailing & post-office errand done (発送・郵便手続きの終了側)
  'package shipped', 'parcel mailed',
  'stamps bought', 'postcard sent',
  'registered mail sent', 'returns mailed',
  'label printed', 'mailbox emptied',
  'po box checked',
];
const closeTabJa = [
  '荷物を発送して', '小包を出して',
  '切手を買って', 'はがきを出して',
  '書留を出して', '返送して',
  '伝票を書いて', 'ポストに投函して',
  '郵便局を出て', 'ゆうパックを出して',
];
const negate = [
  'still mailing', 'about to mail',
  'まだ発送中', 'これから発送する',
];
const nullPins = [
  'mid errand', 'post office', 'mailing stuff',
  '郵便手続き中', '郵便局', '発送手続き',
];

describe('pass CDLV: mailing & post-office idioms (drum)', () => {
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
