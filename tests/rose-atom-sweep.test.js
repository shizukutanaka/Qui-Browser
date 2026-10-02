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
  // lesson / class end
  'lesson over', 'lesson finished', 'class let out',
  'class dismissed lesson', 'practice over lesson',
  'drill done lesson',
  // specific lessons
  'swimming lesson done', 'dance class over',
  'ballet class done', 'karate class done',
  'kendo practice done', 'judo practice done',
  'calligraphy class done', 'painting class done',
  'art class over', 'pottery class done',
  'cooking class done', 'language class done',
  'english class done',
  // tutoring / cram school
  'tutor session done', 'cram school done', 'juku done',
  'homework done juku', 'graded the test juku',
  // recital / grading
  'recital over', 'passed the exam lesson',
  'belt test passed', 'promoted', 'earned the belt',
  'level up lesson', 'advanced a level',
  'completed the course lesson',
  'finished the workbook', 'finished the textbook',
  'graduated the class', 'dan graded', 'shodan earned',
];
const closeTabJa = [
  'レッスンが終わって', 'レッスンを終えて',
  '習い事が終わって', 'お稽古終了',
  'お稽古が終わって', '稽古を終えて',
  'ピアノレッスン終了', 'バレエ終了',
  'ダンスレッスン終了', '水泳教室終了',
  '空手の稽古終了', '剣道の稽古終了',
  '柔道の稽古終了', '書道教室終了', '習字終了',
  '絵画教室終了', '料理教室終了', '英会話終了',
  '塾終了', '塾から帰って', '個人レッスン終了',
  '発表会が終わって', 'おさらい会終了',
  '演奏会終了',
  '昇段', '昇級', '段位が上がって', '級を取って',
  '帯が上がって', '検定に合格', '級に合格',
  '進級して', 'テキストを終えて',
  'ワークブックを終えて', '課題を提出して',
];
const negate = [
  'still in lesson', 'still at practice lesson',
  'まだレッスン中', 'まだ稽古中',
];
const nullPins = [
  'mid lesson', 'about to start lesson', 'textbook',
  'workbook', 'レッスンの途中', '教科書',
  'これからレッスン',
];
const establishedPins = [
  ['lesson done', 'close-tab'],
  ['piano lesson done', 'close-tab'],
  ['rehearsal done', 'close-tab'],
  ['swim lesson done', 'close-tab'],
  ['tutoring done', 'close-tab'],
  ['recital done', 'close-tab'],
  ['belt test done', 'close-tab'],
  ['workbook done', 'close-tab'],
  ['レッスン終了', 'close-tab'],
  ['習い事終了', 'close-tab'],
  ['習い事が終わって', 'close-tab'],
  ['スイミング終了', 'close-tab'],
  ['塾を出て', 'close-tab'],
  ['家庭教師終了', 'close-tab'],
  ['発表会終了', 'close-tab'],
  ['宿題を出して', 'close-tab'],
  ['lesson tomorrow', 'date'],
  ['practice tomorrow', 'date'],
  ['明日レッスン', 'defer'], ['明日習い事', 'defer'],
];

describe('pass CCCLV: lesson & narai-goto end idioms (rose)', () => {
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
