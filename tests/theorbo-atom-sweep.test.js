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
  // bill passed the diet & plenary vote taken
  'bill passed the diet', 'plenary vote taken',
];
const closeTabJa = [
  '国会', '衆議院',
  '参議院', '国会議員',
  '国会審議', '国会法',
  '国会召集', '常会',
  '臨時会', '特別会',
  '国会図書館', '法制局',
  '議院運営委員会', '予算委員会',
  '決算委員会', '本会議',
  '委員会審査', '質問主意書',
  '国政調査権', '証人喚問',
  '議事録', '議長',
  '議員立法', '内閣提出法案',
  '起立採決', '記名投票',
  '国会解散',
];
const negate = [
  'still awaiting the diet session',
  'まだ委員会前', 'これから採決',
];
const nullPins = [
  'about to submit the member bill',
  'about to open the plenary',
  '国会中継', // null-pinned by magnetite (CCCXXV) — registered 議長 instead
];
const establishedPins = [
  // already pinned close-tab — registered '国会解散' instead of 衆院解散/解散総選挙
  ['session adjourned', 'close-tab'],
  ['roll call done', 'close-tab'],
  ['衆院解散', 'close-tab'],
  ['解散総選挙', 'close-tab'],
  // already pinned negate — registered まだ委員会前/これから採決 instead
  ['まだ審議中', 'negate'],
];

describe('pass DCXXXIX: diet & legislative administration idioms (theorbo)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
