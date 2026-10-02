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
  // trip end
  'business trip done', 'business trip over',
  'back from business trip', 'trip wrapped up',
  'work trip done', 'work trip over',
  // client-facing work
  'client visit done', 'site visit done', 'onsite visit done',
  'met the client', 'client meeting done', 'presented to client',
  'demo done for client', 'signed the client', 'negotiations done',
  'handshake done', 'contract talk done', 'factory tour done',
  'inspection done site', 'walked the site', 'site walk done',
  'field visit done', 'visited the branch', 'branch visit done',
  'regional office done',
  // conference / trade show
  'conference done', 'conference over', 'trade show done',
  'booth closed', 'booth torn down', 'booth staffed',
  'cards collected', 'business cards exchanged', 'networked',
  'met vendors', 'vendor meetings done',
  // client entertainment
  'dinner with client', 'client dinner done',
  'entertained the client', 'golf with client done',
  // expenses
  'expensed the trip', 'per diem claimed', 'receipts scanned',
  'mileage logged', 'travel reimbursed', 'reimbursement done',
  // travel back
  'checked out of hotel', 'hotel checkout done', 'flew back',
  'drove back', 'train back', 'back in the office',
  'back at my desk', 'returned to office', 'came back from trip',
  // reporting
  'trip report filed', 'memo sent', 'emails caught up',
  'out of office cleared', 'auto reply off',
];
const closeTabJa = [
  // 出張終了/帰社
  '出張終了', '出張が終わって', '出張を終えて',
  '出張から戻って', '出張から帰って', '帰社して', '帰社した',
  // 報告/精算
  '帰社報告して', '出張報告を出して', '出張報告終了',
  '報告書を出して', '報告書を書いて', '出張精算を出して',
  '出張精算終了', '旅費を精算して',
  // 商談/視察
  'クライアントに会って', '商談成立して', '現地視察終了',
  '視察終了', '工場見学終了',
  // 展示会/懇親
  '展示会終了', '展示会が終わって', 'ブースを畳んで',
  'ブース撤収', '名刺交換して', '名刺を交換して',
  '接待終了', '会食終了', '接待ゴルフ終了', '夕食会終了',
  // 移動/帰宅
  '出張先を出て', 'ホテルをチェックアウトして',
  '現地を離れて', '出張明け', '出張明けです',
  '出張の片付けをして', 'スーツケースを解いて',
  '出張土産を配って', '在宅に戻って', '直行から帰宅して',
  '直帰して', '出先から戻って', '外出から戻って',
  '外回り終了', '外回りが終わって', '営業回り終了',
];
const negate = [
  'still on the road', 'still traveling work', 'まだ出張中',
];
const nullPins = [
  'on site now', 'mid trip', 'trip ongoing',
  'packing for the trip', '出張の途中', '出張先にいる',
  '出張地にいる',
];
const establishedPins = [
  ['back from the trip', 'close-tab'],
  ['closed the account', 'close-tab'],
  ['terms agreed', 'close-tab'], ['audit done', 'close-tab'],
  ['networking done', 'close-tab'],
  ['expense report filed', 'close-tab'],
  ['expenses filed', 'close-tab'], ['debrief done', 'close-tab'],
  ['report submitted', 'close-tab'],
  ['領収書をまとめて', 'close-tab'], ['懇親会終了', 'close-tab'],
  ['pitch done client', 'speech-pitch-status'],
  ['trip tomorrow', 'date'], ['flying out tomorrow', 'date'],
  ['client meeting tomorrow', 'date'], ['明日出張', 'defer'],
  ['出張に行って', 'go-to'], ['視察に行って', 'go-to'],
  ['取引先に行ってきた', 'go-to'], ['客先に行ってきた', 'go-to'],
  ['得意先に行ってきた', 'go-to'], ['支社に行ってきた', 'go-to'],
  ['営業所に行ってきた', 'go-to'],
];

describe('pass CCCXLIX: business trip end idioms (peony)', () => {
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
