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
  // local-festival role & cleanup done (祭り役割分担・片付けの終了側)
  'festival duty done', 'parade marshalled',
  'float returned', 'cleanup crew done',
  'mikoshi carried', 'drinks served',
];
const closeTabJa = [
  '祭りの当番', '屋台の当番',
  'パレードを終えて', '神輿を担いで',
  '片付け当番', 'お神酒を振る舞って',
  '境内を掃除して', 'お囃子を練習して',
  '提灯を片付けて',
];
const negate = [
  'still on duty', 'about to clean up',
  'まだ当番中', 'これから片付ける',
];
const nullPins = [
  'mid festival', 'festival committee',
  '祭り実行委員',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['booth staffed', 'close-tab'],
  ['shrine visit done', 'close-tab'],
];

describe('pass CDLXVII: festival-duty idioms (uke)', () => {
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
