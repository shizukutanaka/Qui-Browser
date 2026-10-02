const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  return new VoiceCommands({ speak: () => {}, onCommand: () => {} });
}
const key = (vc, p) => vc._matchCommand(p).key;

const closeTab = [
  // interview done
  'interview over', 'interview done', 'interview finished', 'the interview went well',
  'screening call done', 'phone screen done', 'second round done',
  'final round done', 'last interview done', 'panel interview done',
  'onsite done', 'onsite interview done', 'technical interview done',
  'coding challenge done', 'take home done', 'assignment submitted',
  'portfolio sent', 'cover letter done', 'resume sent', 'application submitted',
  'application in', 'job search done', 'thank you note sent',
  // selection results
  'offer letter', 'offer came in', 'offer signed', 'signed the offer',
  'accepted the offer', 'got the job', 'hired', 'selected', 'start date set',
  'first day scheduled', 'background check cleared', 'references checked',
  'drug test done', 'paperwork submitted', 'benefits enrolled',
  'nda signed', 'employment contract signed',
  // onboarding / resignation
  'onboarded', 'onboarding done', 'orientation done', 'first day done',
  'first week done', 'probation passed', 'training done', 'mentor assigned',
  'badge issued', 'laptop set up', 'email account set up', 'quit my job',
  'resigned', 'notice given', 'resignation accepted', 'last day of work',
  'last day done', 'farewell lunch done', 'exit interview done',
  'laptop returned', 'badge returned', 'severance signed',
  // rejections are endings too
  'rejected', 'thank you for applying', 'we went with another candidate',
  'お祈りメール',
];

const closeTabJa = [
  // 面接/選考終了
  '面接終了', '面接が終わって', '面接を終えて', '一次面接終了',
  '二次面接終了', '最終面接', '最終面接終了', '役員面接終了',
  '面談終了', 'カジュアル面談終了', '適性検査終了', '課題提出済み',
  'ポートフォリオを送って', '履歴書を送って', '職務経歴書を送って',
  'エントリー完了', '応募完了', '選考終了', '書類選考通過',
  'お礼メールを送って',
  // 結果/内定
  '内定', '内定をもらって', '内定通知', '内定承諾', '内定式終了',
  '採用決定', '採用されて', '採用が決まって', '合格', '最終結果',
  '入社が決まって', 'オファーレター', '労働条件通知書',
  '背景調査終了', 'リファレンスチェック終了',
  // 入社/退職手続き
  '入社手続き', '入社書類', '入社手続き完了', '雇用契約を結んで',
  '研修終了', '新人研修終了', 'オリエンテーション終了', '試用期間終了',
  '本採用', '初出社', '初出社終了', '最初の一週間が終わって',
  '退職届を出して', '退職', '辞表を出して', '退職が受理されて',
  '退職日が決まって', '最終出社', '最終出社日', '送別会終了',
  '退職手続き完了', '離職票を受け取って', '会社を去って',
  '不採用', 'お見送り', '不採用通知',
];

const negate = [
  'keep applying', 'stay in the process', 'still interviewing',
  'keep job hunting', 'まだ面接中', 'まだ選考中', '就活を続けて',
];

const nullPins = [
  // in progress / waiting
  'waiting to hear back', 'awaiting results', 'in the interview',
  'mid interview', 'currently job hunting', 'application pending',
  'interview scheduled', '面接中',
  '面接予定', '選考中', '結果待ち', '就活中', '応募中',
  '面接を受けている最中', '審査中',
];

const establishedPins = [
  ['interview tomorrow morning', 'date'],
  ['paperwork done', 'close-tab'],
  ['two weeks notice', 'close-tab'],
  ['引き継ぎ完了', 'close-tab'],
];

describe('Voice atoms CCCXXIX — interview end & hiring end', () => {
  test.each(closeTab)('"%s" -> close-tab', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => ({ pinned: false }), closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each(closeTabJa)('"%s" -> close-tab (JA)', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => ({ pinned: false }), closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each(negate)('"%s" -> negate', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => null, closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe('negate');
  });

  test.each(nullPins)('"%s" -> null (in progress)', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => null, closeTab: () => {}, tabs: () => [] });
    expect(vc._matchCommand(p)).toBeNull();
  });

  test.each(establishedPins)('"%s" -> %s (pre-existing)', (p, k) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => null, closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe(k);
  });
});
