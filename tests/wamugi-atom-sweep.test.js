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
  // job-change agent & interview pipeline done
  'agent registered', 'resume submitted',
  'scout replied', 'first interview done',
  'second interview done', 'final interview done',
  'reference check done', 'salary negotiated',
  'start date agreed',
];
const closeTabJa = [
  'エージェントに登録して', '職務経歴書を出して',
  'スカウトに返信して', '一次面接を終えて',
  '二次面接を終えて', '最終面接を終えて',
  'リファレンスチェックが終わって', '年収を交渉して',
  '入社日が決まって', '内定を承諾して',
];
const negate = [
  'still waiting on the offer', 'まだ内定待ち',
];
const nullPins = [
  'about to register', 'mid negotiation',
  'job agent', 'career change',
  'これから登録する', '交渉中',
  '転職エージェント', 'キャリア相談',
];
const establishedPins = [
  ['offer accepted', 'close-tab'],
  ['still interviewing', 'negate'],
  ['まだ面接中', 'negate'],
];

describe('pass CDXXXVII: job-change agent & interview pipeline idioms (wamugi)', () => {
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
