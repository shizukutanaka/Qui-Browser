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
  // hospital visit end
  'visit done hospital', 'visiting done', 'visited the hospital',
  'visited grandma', 'visited grandpa', 'visited mom',
  'visited dad', 'visited a friend', 'visit to the hospital done',
  'hospital visit done', 'visiting hours over',
  'visiting hours ended', 'visiting time up',
  'time to leave hospital', 'nurse asked us to leave',
  'had to leave the ward', 'left the ward',
  'left the hospital room', 'room visit done',
  // well-wishes & gifts
  'said get well soon', 'wished them well', 'get well soon said',
  'flowers delivered hospital', 'brought flowers',
  'gift dropped off', 'care package delivered',
  'saw the patient', 'patient looked good', 'looking better',
  'on the mend', 'cheered them up',
  // checking on people
  'company visit done', 'checked on a friend',
  'checked in on them', 'stopped by their place',
  'house visit done', 'dropped by unannounced',
  // guests leaving
  'guests left', 'visitors gone', 'visitors went home',
  'company left', 'saw the guests off', 'saw them out',
  'showed them out', 'walked them to the door',
  'hosting done', 'done hosting', 'hosted the guests',
  'entertained guests', 'everyones gone home',
  'house quiet again', 'tea served', 'brought out snacks',
  'cleared the cups', 'tidied after guests',
  'after guests left', 'wave from the door',
  'stood at the door', 'door closed behind them',
  'house to ourselves',
];
const closeTabJa = [
  // お見舞い/面会
  'お見舞い終了', '見舞い終了', '病院にお見舞い',
  '面会時間終了', '面会時間が切れて', '面会時間が終わって',
  '面会を終えて', '病室を後にして', '患者さんに会って',
  '入院中の友達に会って', '祖母に会ってきた',
  '祖父に会ってきた', '看病してきた', '付き添い終了',
  '付き添いが終わって', '見守り終了',
  // 励まし/差し入れ
  '元気づけてきた', '励ましてきた', '見舞いの品を渡して',
  '果物を届けて', '花を届けて', '差し入れを渡して',
  '回復してきたみたい', '元気そうだった', '退院が近そう',
  'お大事にと言って', 'お大事にしてと伝えて',
  // 来客退出
  '来客が帰って', 'お客さんが帰って', '客人が帰って',
  'お客様がお帰りに', '玄関で見送って', '門まで送って',
  // もてなし終了
  'おもてなし終了', 'お茶を出して', 'お菓子を出して',
  '客人をもてなして', 'もてなしを終えて',
  '家が静かになって', '玄関を閉めて', 'インターホン終了',
  'チャイムが鳴り止んで', '来客対応終了',
];
const negate = ['still visiting someone'];
const nullPins = [
  'visiting now', 'mid visit hospital', 'with the patient',
  'at their bedside', 'by their side', 'stop by later',
  'guests coming over', 'company coming',
  'まだ面会中', '面会の途中', '病室にいる', '付き添い中',
];
const establishedPins = [
  ['guests went home', 'close-tab'], ['客が帰って', 'close-tab'],
  ['面会終了', 'close-tab'], ['病室を出て', 'close-tab'],
  ['hospital tomorrow', 'date'], ['visiting tomorrow', 'date'],
  ['明日面会', 'defer'], ['明日お見舞い', 'defer'],
  ['お見舞いに行ってきた', 'go-to'], ['見舞いに行ってきた', 'go-to'],
  ['見舞いに行って', 'go-to'], ['面会に行ってきた', 'go-to'],
  ['面会に行って', 'go-to'],
  ['おばあちゃんに会いに行って', 'go-to'],
  ['おじいちゃんに会いに行って', 'go-to'],
];

describe('pass CCCXLVII: hospital visit / guest departure idioms (lily)', () => {
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
