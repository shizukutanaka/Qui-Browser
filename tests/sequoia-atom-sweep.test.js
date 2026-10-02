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
  // dropoff / pickup
  'kids dropped off', 'dropped off the kids', 'drop off done',
  'school drop off done', 'daycare dropoff', 'dropped at daycare',
  'kids picked up', 'picked up the kids', 'school pickup done',
  'after school pickup', 'soccer practice drop', 'carpool done',
  'carpool drop', 'grandma picked them up',
  // bedtime routine
  'bedtime done', 'kids in bed', 'kids asleep', 'kids are down',
  'both kids asleep', 'asleep finally', 'bedtime story done',
  'read the bedtime story', 'story time done', 'sang the lullaby',
  'teeth brushed', 'kids brushed teeth', 'bath done',
  'kids bathed', 'bath time done', 'diaper changed',
  'changed the diaper', 'potty break done',
  // school admin
  'homework checked', 'checked the homework', 'lunch packed',
  'lunches packed', 'permission slip signed',
  'signed the permission slip', 'backpack ready',
  'uniform ready', 'school lunch paid', 'tuition paid',
  'daycare paid', 'babysitter arrived', 'babysitter home',
  // events / lessons
  'playdate over', 'playdate done', 'playdate ended',
  'kids came home', 'kids home', 'kids back',
  'kids homework done', 'kids finished homework',
  'kids ate dinner', 'dinner fed', 'kids fed', 'fed the kids',
  'snack done', 'nap over', 'nap done', 'woke up from nap',
  'naps over', 'slept through the night', 'slept all night',
  'weaning done', 'potty trained', 'potty training done',
  'training wheels off', 'learned to ride',
  'first day of school done', 'school event done', 'recital done',
  'kids recital done', 'sports day done', 'practice picked up',
  'swim lesson done', 'piano lesson done', 'kids lessons done',
  'summer camp done', 'camp pickup', 'scout meeting done',
  'birthday party done', 'party cleaned up',
];
const closeTabJa = [
  // 送迎
  '送り終えて', '送迎終了', '送ってきた', '保育園に送って',
  '幼稚園に送って', '学校に送って', '学童に送って',
  '迎えてきた', '保育園に迎えて', '学童に迎えて',
  '預けてきた', '預けました', '子供を預けて',
  '習い事に送って', '塾に送って', 'お迎えが終わって',
  '帰ってきた', '子供が帰って', '実家に預けて',
  '親に預けて', '公園から帰って', '遊び場から帰って',
  // 寝かしつけ
  '寝かしつけ終了', '寝かしつけ完了', '寝た', '寝ました',
  '眠りについた', '眠りに就いて', 'すやすや眠って', '眠りました',
  '寝入って', '寝顔を見て', 'おやすみのキス',
  '読み聞かせ終了', '絵本を読んで', '子守唄を歌って',
  // 身支度/世話
  '歯磨きした', '歯を磨かせて', 'お風呂に入れて',
  '風呂に入れて', '沐浴終了', 'おむつ替えて',
  'おむつを替えて', 'トイレに行かせて', '哺乳瓶を洗って',
  'ミルクをあげて', '授乳終了', '離乳食をあげて',
  '食べさせて', 'ご飯を食べさせて',
  // 学校/行事
  '宿題を見て', '宿題をチェックして', 'ランドセルを用意して',
  '連絡帳に書いて', 'プリントに記入して', '提出物を書いて',
  '参観日終了', '運動会終了', '習い事が終わって',
  '習い事終了', 'ピアノのレッスン終了', 'スイミング終了',
  'ベビーシッターが来て', 'シッターに頼んで',
  'お昼寝終了', '昼寝が終わって', '夜泣きが終わって',
  'トイトレ終了', 'トイレトレーニング終了', '卒乳',
  '断乳終了',
];
const negate = [
  'kids still up', 'still feeding', 'still rocking the baby',
  'one more story', 'more pages to read', 'not asleep yet',
  'still putting them down', 'still on pickup duty',
  'もう一冊読んで', 'まだ寝ない', '寝かしつけを続けて',
];
const nullPins = [
  'bedtime routine ongoing', 'mid feeding', 'feeding now',
  'packing lunches', 'in the middle of bedtime',
  '寝かしつけ中', '授乳中', 'ミルクをあげてる', '子供が起きてる',
];
const establishedPins = [
  ['pickup done', 'close-tab'], ['backpack packed', 'close-tab'],
  ['first day done', 'close-tab'], ['tournament over', 'close-tab'],
  ['lesson done', 'close-tab'],
  ['保護者会終了', 'close-tab'], ['発表会終了', 'close-tab'],
  ['still up', 'working-status'], ['still awake', 'working-status'],
  ['still reading to them', 'speaking-status'],
  ['寝かせて', 'sleep-mode'], ['ぐっすり寝て', 'sleep-mode'],
  ['まだ起きてる', 'negate'],
  ['迎えに行って', 'go-to'], ['お迎えに行って', 'go-to'],
  ['遊びに行って', 'go-to'],
  ['homework tomorrow', 'date'], ['tomorrow school event', 'date'],
  ['明日運動会', 'defer'], ['明日参観日', 'defer'],
];

describe('pass CCCXLI: childcare dropoff/bedtime end idioms (sequoia)', () => {
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
