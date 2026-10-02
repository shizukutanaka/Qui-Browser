/**
 * Voice atoms CCCXX — school-term & exam-end idioms (EN)
 * + 終業/試験終了/下校 (JA). School's out = close the tab.
 * Enrollment, class time, and ongoing studies stay out.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  const tabs = [{ id: 1, url: 'https://a.example', title: 'A' }];
  vc.connectBrowser({
    getActiveTab: () => tabs[0],
    closeTab: () => {},
    tabs: () => tabs,
  });
  return vc;
}

function key(vc, phrase) {
  const r = vc._matchCommand(phrase);
  return r && r.key;
}

const closeTab = [
  // --- dismissal ---
  'school let out', 'schools out for summer', 'schools out',
  'final bell rang', 'last bell rang', 'bell dismissed us',
  'dismissed from class', 'class dismissed', 'classes over',
  'last day of school', 'school year ended', 'school year over',
  'academic year over', 'term ended', 'term is over',
  'semester ended', 'semester is over', 'semester wrapped',
  'quarter ended', 'trimester over', 'school done for the year',
  // --- vacation ---
  'summer vacation began', 'summer break started', 'summer vacation',
  'winter break started', 'spring break started', 'break began',
  'holiday break', 'schools on break', 'recess forever',
  'no more pencils no more books', 'schools out forever',
  // --- exams done ---
  'exams over', 'exams done', 'finals done', 'finals over',
  'last exam done', 'final exam finished', 'test finished',
  'turned in the exam', 'handed in the exam', 'pencils down',
  'pen down', 'papers collected', 'blue books collected',
  'proctor called time', 'time called on the exam',
  'graded and done', 'grades posted', 'grades are out',
  'report card came', 'transcript issued', 'gpa calculated',
  'passed the class', 'aced the final', 'graduated',
  // --- leaving campus ---
  'locker emptied', 'locker cleaned out', 'textbooks returned',
  'returned the textbooks', 'library books returned',
  'dorm checked out', 'moved out of the dorm', 'dorm emptied',
  'campus emptied', 'classroom emptied', 'desks empty',
  'chalkboard erased', 'whiteboard wiped', 'backpack packed',
  'walked out the gates', 'left campus', 'off campus',
  'bus pulled away', 'last school bus', 'picked up from school',
  'lunchbox empty', 'cafeteria closed', 'gym locked up',
];

const closeTabJa = [
  // --- 終業/学期末 ---
  '終業式', '終業式終了', '学期終了', '学期が終わって',
  '前期終了', '後期終了', '一学期終了', '二学期終了',
  '学年末終了', '今年度終了', '年度末終了', '授業終了',
  '最後の授業', '最終授業', 'チャイムが鳴って',
  '最後のチャイム', '終了のチャイム', '放課後',
  '授業が終わって', '全部の授業終了', '学校が終わって',
  // --- 休み ---
  '夏休み', '夏休み始め', '夏休み開始', '冬休み', '春休み',
  '長期休暇', '学休', '休みに入って', '部活休み',
  // --- 試験終了 ---
  '試験終了', '試験が終わって', '定期試験終了', '期末試験終了',
  '中間試験終了', 'テスト終了', '最後のテスト', '答案を出して',
  '答案用紙を回収して', '鉛筆を置いて', '筆記用具を置いて',
  '監督が終了を告げて', '時間切れで終わって', '採点済み',
  '成績発表', '成績表が届いて', '通知表', '通知表をもらって',
  '単位を取って', '進級', '卒業', '修了', '修了証書',
  // --- 下校/片付け ---
  '下校', '下校した', '学校を出て', '校門を出て',
  '帰りの会終了', '帰宅します', 'ロッカーを空にして',
  '教科書を返して', '図書室の本を返して', '教科書を返却して',
  '机を片付けて', '黒板を消して', 'ホワイトボードを消して',
  '掃除が終わって', '教室掃除終了', '教室を出て',
  '校庭が静まって', '校舎が静まって', '体育館を施錠して',
  '給食終了', '弁当を食べ終えて', '上履きをしまって',
  'ランドセルを背負って', '部活終了', '部室を出て',
];

const negate = [
  'stay after school', 'stay for detention', 'keep studying',
  'stay in class', 'still studying', 'まだ授業中',
  '勉強を続けて', '残って勉強して', '居残りして',
];

const nullPins = [
  // enrollment / class time / ongoing
  'enrolled', 'first day of school', 'back to school',
  'in class', 'class in session', 'studying', 'taking exams',
  'exam week', 'midterms coming', 'school started',
  '入学', '入学した', '新学期', '授業中', '登校',
  '登校した', '通学中', '試験期間中', 'テスト勉強中',
  '宿題をしてる', '出席中',
];

const establishedPins = [
  ['school is out', 'close-tab'],
  ['学校に行く', 'go-to'],
];

describe('Voice atoms CCCXX — school-term & exam-end idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
  test.each(nullPins.map((p) => [p]))('"%s" -> null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k) => {
    expect(key(makeVC(), p)).toBe(k);
  });
});
