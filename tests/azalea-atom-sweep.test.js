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
  // training / seminar end
  'training over', 'training session done',
  'onboarding training done', 'induction done',
  'workshop training done', 'seminar done', 'seminar over',
  'course done', 'completed the course', 'passed the course',
  // certification
  'certification done', 'got certified', 'passed the exam',
  'exam passed', 'aced the test', 'test done certification',
  'written test done', 'practical test done', 'skills test done',
  'license exam done', 'driving test passed',
  'passed the road test', 'language test done', 'toefl done',
  'ielts done', 'interview exam done', 'bar exam done',
  'boards done', 'board exam done', 'medical boards done',
  'cert renewed', 'recertified', 'recertification done',
  'continuing ed done', 'ce credits done', 'credits earned',
  // modules / drills
  'last module done', 'final quiz done', 'assessment done',
  'eval done', 'debrief training done', 'roleplay done',
  'simulation done', 'drill done', 'fire drill done',
  'safety training done', 'cpr certified',
  'first aid course done', 'food handler cert',
  // apprenticeship / bootcamp
  'bootcamp done', 'bootcamp finished', 'graduated bootcamp',
  'apprenticeship done', 'journeyman now', 'shadowing done',
  'ride along done',
  // study sessions
  'studied for the exam', 'study group done',
  'crammed all night', 'review session done',
];
const closeTabJa = [
  // 研修/講習
  '研修が終わって', '研修を終えて', '社内研修終了',
  '研修会終了', '講習終了', '講習会終了',
  '講習を受けてきた', '受講終了', '受講が終わって',
  '座学終了', '実習終了', '実技研修終了',
  'ロールプレイ終了', 'ロープレ終了', 'グループワーク終了',
  // 試験/資格
  '筆記試験終了', '実技試験終了', '技能試験終了',
  '学科試験終了', '資格取得して', '資格に合格して',
  '試験に合格して', '一発合格', '検定に受かって',
  '漢検終了', '英検終了', '運転免許を取って',
  '免許試験終了', '仮免に受かって', '卒検終了',
  '教習所を卒業して',
  // 更新/法定
  '更新講習終了', '免許更新終了', '法定講習終了',
  '安全講習終了', '救命講習終了', 'cpr講習終了',
  '食品衛生講習終了', '防火管理者講習終了',
  // 修了/学習
  '修了証をもらって', '修了して', '終了証を受け取って',
  '修了テスト終了', '練習問題を解いて', '一夜漬けして',
  '詰め込んで',
];
const negate = ['still training', 'まだ研修中'];
const nullPins = [
  'in training now', 'mid course', 'course ongoing',
  'certification exam', 'sign up for the course',
  'enrolled in class', '研修の途中', '受講中',
  '試験を受けて',
];
const establishedPins = [
  ['training done', 'close-tab'], ['orientation done', 'close-tab'],
  ['course finished', 'close-tab'], ['module done', 'close-tab'],
  ['quiz done', 'close-tab'], ['flashcards done', 'close-tab'],
  ['practice test done', 'close-tab'], ['mock exam done', 'close-tab'],
  ['研修終了', 'close-tab'], ['新人研修終了', 'close-tab'],
  ['オリエンテーション終了', 'close-tab'],
  ['資格試験終了', 'close-tab'], ['資格を取って', 'close-tab'],
  ['検定終了', 'close-tab'], ['模擬試験終了', 'close-tab'],
  ['模試終了', 'close-tab'], ['過去問を解いて', 'close-tab'],
  ['course certificate', 'security-status'],
  ['certificate earned', 'security-status'],
  ['exam tomorrow', 'date'], ['test tomorrow', 'date'],
  ['明日試験', 'defer'], ['明日研修', 'defer'],
  ['研修に行って', 'go-to'], ['講習に行って', 'go-to'],
];

describe('pass CCCL: training / certification end idioms (azalea)', () => {
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
