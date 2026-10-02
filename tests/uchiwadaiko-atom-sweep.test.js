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
  // cemetery plot & columbarium contract procedures done
  'plot contract signed', 'burial rights granted',
  'remains moved',
];
const closeTabJa = [
  '墓地購入', '永代使用権',
  '納骨堂', '改葬',
  '墓石', '樹木葬',
  '永代供養', '霊園',
  '管理料', '墓所',
  '埋蔵証明書', '受入証明書',
  '改葬許可', '分骨',
  '合祀', '供養塔',
  '塔婆', '卒塔婆',
  '墓地使用料', '墓地購入申込',
  '墓地継承', '改葬届',
  'お墓引越し', '納骨式',
  '建立', '墓地管理規則',
];
const negate = [
  'still looking for a plot', 'about to visit the cemetery',
  'まだ探し中', 'これから見学',
];
const nullPins = [
  'mid transfer paperwork',
];
const establishedPins = [
  ['墓じまい', 'negate'],
];

describe('pass DXXXVI: cemetery & columbarium contract idioms (uchiwadaiko)', () => {
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
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
