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
  // proposal & engagement
  'ring on her finger', 'engaged',
  // venue & date
  'venue booked', 'date set wedding',
  'wedding venue locked', 'officiant booked',
  // invites & guests
  'save the dates sent', 'invitations mailed',
  'guest list finalized', 'registry done wedding',
  // details locked
  'dress picked', 'menu picked',
  'seating chart done', 'cake tasted',
  'flowers ordered wedding', 'band booked',
  'honeymoon booked', 'rehearsal done wedding',
];
const closeTabJa = [
  'オーケーをもらって', '式場を予約して',
  '日取りを決めて', '招待状を送って',
  'ドレスを選んで', '引出物を決めて',
  '席次表ができて', 'ケーキを試食して',
  '生花を頼んで', 'バンドを予約して',
  '新婚旅行を予約して', 'ゲストリスト完成',
  'リハーサル終了結婚式', '入籍しました',
  '婚姻届を出して', '指輪をはめて',
];
const negate = [
  'still planning the wedding', 'still waiting for an answer',
  'まだ準備中', 'まだ婚活中',
];
const nullPins = [
  'about to propose', 'mid proposal',
  'engagement ring', 'guest list', 'wedding planner',
  'プロポーズの途中', 'これからプロポーズ',
  '婚約指輪', '席次表',
];
const establishedPins = [
  ['proposed', 'close-tab'], ['she said yes', 'close-tab'],
  ['said yes', 'close-tab'], ['bachelor party done', 'close-tab'],
  ['プロポーズ成功', 'close-tab'], ['婚約しました', 'close-tab'],
  ['指輪を渡して', 'close-tab'],
  ['wedding tomorrow', 'date'], ['明日結婚式', 'defer'],
];

describe('pass CCCLXXXI: proposal & wedding-prep done idioms (birchwood)', () => {
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
