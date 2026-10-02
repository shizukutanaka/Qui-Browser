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
  // workers'-comp claim procedures done
  'workers comp filed', 'claim accepted',
  'medical benefits paid', 'disability rating assigned',
  'appeal lodged',
];
const closeTabJa = [
  '労災認定', '労災申請',
  '療養補償', '休業補償',
  '障害補償', '業務上疾病',
  '通勤災害', '災害補償',
  '労働基準監督署', '第三者行為災害',
  '遺族補償', '安全衛生委員会',
  '過労死認定',
];
const negate = [
  'still gathering evidence',
];
const nullPins = [
  'mid dispute',
];
const establishedPins = [
  ['still under review', 'negate'],
  ['about to file the claim', 'negate'],
  ['まだ審査中', 'negate'],
  ['障害等級', 'close-tab'],
];

describe('pass DXIII: workers-comp claim idioms (hyosho)', () => {
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
