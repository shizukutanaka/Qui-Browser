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
  // mental-health welfare procedures done
  'outpatient treatment started',
  'peer support meeting done',
];
const closeTabJa = [
  '精神保健福祉', '精神障害者保健福祉手帳',
  '精神通院', '相談支援事業',
  'ピアサポート', '作業所',
  '就労移行', '社会復帰',
  '退院支援', '精神保健福祉センター',
  '保健所', '地域活動支援センター',
  '精神障害者', '障害福祉計画',
];
const negate = [
  'still in treatment',
  'これから受診', 'まだ相談前',
];
const nullPins = [];
const establishedPins = [
  ['handbook issued', 'close-tab'],
  ['about to visit', 'negate'],
  ['自立支援医療', 'close-tab'],
  ['デイケア', 'close-tab'],
  ['訪問看護', 'close-tab'],
  ['更新手続き', 'close-tab'],
  ['まだ通院中', 'negate'],
];

describe('pass DXLII: mental-health welfare idioms (flute)', () => {
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
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
