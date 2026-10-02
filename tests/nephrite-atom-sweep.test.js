/**
 * Voice atoms CCCXXVIII — outpatient visit end & pharmacy pickup idioms (EN)
 * + 診察終了/処方受取 (JA). Seen the doctor, paid, meds in hand = close the tab.
 * In-progress care, admissions, and appointment bookings stay out
 * (CCCXVII covered discharge & recovery).
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
  // --- appointment done ---
  'checkup done', 'checkup finished', 'appointment over',
  'appointment done', 'doctors appointment done', 'saw the doctor',
  'seen the doctor', 'visit done', 'clinic visit done',
  'consultation done', 'consult done', 'exam done', 'physical done',
  'annual physical done', 'wellness visit done', 'dental cleaning done',
  'teeth cleaned', 'cavity filled', 'eye exam done', 'new prescription',
  'glasses ordered', 'called in', 'name called', 'vitals taken',
  'blood pressure taken', 'weighed in', 'height measured',
  'waiting room emptied', 'last patient out', 'clinic closed',
  'out of the clinic', 'left the clinic', 'out of the office',
  'doctors office cleared',
  // --- tests & imaging done ---
  'blood drawn', 'bloodwork done', 'labs done', 'lab work done',
  'xray done', 'x ray done', 'scan done', 'mri done', 'ct done',
  'ultrasound done', 'ekg done', 'mammogram done', 'scope done',
  'biopsy done', 'sample collected', 'swab done', 'test results in',
  'results came back', 'all clear on the labs', 'referral in hand',
  'second opinion done',
  // --- payment & pharmacy ---
  'copay paid', 'paid the copay', 'insurance billed', 'claim filed',
  'checkout done at the desk', 'receipt in hand', 'receipts filed',
  'prescription filled', 'script filled', 'rx filled', 'meds picked up',
  'picked up the prescription', 'pharmacy run done', 'pharmacy stop done',
  'medication in hand', 'refill picked up', 'refill done',
  'antibiotics in hand', 'inhaler refilled', 'follow up booked',
  'next appointment booked', 'appointment card in hand',
];

const closeTabJa = [
  // --- 診察終了 ---
  '診察終了', '診察が終わって', '診察が済んで', '診療終了',
  '診てもらいました', '先生に診てもらって', '問診票を出して',
  '名前を呼ばれて', 'バイタル測定', '血圧を測って', '身長体重を測って',
  '待合室を出て', '診察室を出て', 'クリニックを出て',
  '診察券をしまって', '受付を済ませて', '会計を済ませて',
  'お会計を済ませて', '領収書をもらって', '明細をもらって',
  '健康診断終了', '人間ドック終了', '定期検診終了', '内科終了',
  '歯医者終了', '歯科検診終了', '抜歯しました', '治療が終わって',
  '眼科終了', '視力検査終了', '皮膚科終了',
  // --- 検査 ---
  '採血終了', '採血しました', '検査終了', '検査が終わって',
  '血液検査終了', 'レントゲン終了', 'レントゲンを撮って',
  'mri終了', 'ct終了', 'エコー終了', '心電図終了',
  '胃カメラ終了', '内視鏡終了', '検査結果が出て',
  '結果を聞いて', '経過観察になりました', '紹介状をもらって',
  // --- 処方/予約 ---
  '処方箋をもらって', '処方箋を出してもらって', '薬局で受け取って',
  '薬を受け取って', '薬をもらって', '調剤済み', 'お薬手帳をもらって',
  'リフィル済み', '次回予約', '次回予約を取って', '再来院の予約',
  '予約を入れて', '診察予約完了', '定期受診終了',
];

const negate = [
  'stay at the clinic', 'keep the appointment going', 'still at the doctor',
  'keep taking the meds', 'まだ診察中', 'まだ通院中',
  '待合室に残って', '薬を飲み続けて',
];

const nullPins = [
  // in progress / scheduled
  'waiting for the doctor', 'in the waiting room', 'in the exam room',
  'mid checkup', 'seeing the doctor', 'booked an appointment',
  'on medication', 'taking medication',
  'under observation', '待合室で待って', '診察待ち', '診察中',
  '通院中', '服薬中', '処方中', '検査中', '予約済み',
  '明日の予約', '病院予約', '通院予定',
];

const establishedPins = [
  ['appointment tomorrow', 'date'],
  ['follow up scheduled', 'close-tab'],
  ['病院を出て', 'close-tab'],
];

describe('Voice atoms CCCXXVIII — outpatient visit end & pharmacy', () => {
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
