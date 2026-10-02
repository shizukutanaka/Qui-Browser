/**
 * Voice atoms CCCX — election & ballot-end idioms (EN)
 * + 投票締切/開票終了/任期終了 (JA). The polls closing /
 * concession speech closes the tab. Campaign-start and
 * keep-campaigning forms stay out.
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
  // --- polls close / counting ---
  'polls closed', 'the polls have closed', 'polls are closed',
  'voting ended', 'voting is over', 'last vote cast',
  'ballot box sealed', 'ballots counted', 'votes tallied',
  'counting is done', 'count finished', 'tally complete',
  'all ballots in', 'every vote counted', 'precincts reported',
  'all precincts in', 'one hundred percent reporting',
  'results certified', 'certified the results', 'results are in',
  'official count done', 'final tally', 'final numbers in',
  'election night over', 'election over', 'election decided',
  'race is called', 'race called', 'called the race',
  'projection made', 'declared the winner', 'winner declared',
  'landslide victory', 'won by a landslide', 'swept the vote',
  // --- concession / concede ---
  'conceded the race', 'concession speech given',
  'conceded defeat', 'conceded gracefully', 'bowed out of the race',
  'dropped out of the race', 'out of the running',
  'lost the election', 'defeated at the polls', 'voted out',
  'voted out of office', 'out of office', 'unseated',
  'recount done', 'recount finished', 'recount settled it',
  'court upheld the result', 'transition begun',
  'transition of power', 'peaceful transfer',
  // --- term end / office handover ---
  'term ended', 'term is up', 'end of term', 'lame duck',
  'lame duck session', 'sworn in', 'swearing in done',
  'inaugurated', 'inauguration over', 'took the oath',
  'oath of office done', 'keys handed over', 'moved out of office',
  'cleared the desk', 'office vacated', 'final day in office',
];

const closeTabJa = [
  // --- 投票締切/開票 ---
  '投票締切', '投票締め切り', '投票終了', '投票が終わった',
  '投票箱を閉じて', '開票', '開票終了', '開票が終わった',
  '票を数えて', '集計終了', '集計が終わった', '全票集計',
  '当確', '当選確実', '当選確定', '当選', '当選発表',
  '当選しました', '圧勝', '大差で当選', '全開票所終了',
  '選挙終了', '選挙が終わった', '選挙戦終了', '投票率確定',
  '結果確定', '公式発表', '当選証書',
  // --- 敗北/撤退 ---
  '敗戦の弁', '敗北宣言', '敗戦を認めて', '落選', '落選確定',
  '次点', '惜敗', '敗北を認めて', '出馬を取り下げて',
  '選挙に敗れて', '票差で負けて', '再選ならず',
  '現職が敗れて', '新人が勝って', '政権交代',
  '再集計終了', '異議申し立て終了', '訴訟終了',
  // --- 任期終了/引き継ぎ ---
  '任期終了', '任期が切れて', '任期満了', '退任', '退任式',
  '最後の登庁', '離任', '引き継ぎ', '引き継ぎ完了',
  '事務引き継ぎ', '就任', '就任式', '就任演説終了',
  '宣誓', '宣誓を終えて', '辞令交付', '退室',
  '机を片付けて', '役職を降りて', '議席を失って',
];

const negate = [
  'keep campaigning', 'stay in the race',
  'the campaign continues', '選挙活動を続けて', 'まだ選挙中',
  '立候補を続けて',
];

const nullPins = [
  // campaign start / voting intent = setup, not ending
  'vote for me', 'register to vote', 'election day',
  'campaign starts', 'running for office', 'announced candidacy',
  '立候補', '出馬', '支持します',
  '投票日', '期日前投票', '不在者投票',
];

const establishedPins = [
  ['当選', 'close-tab'],
  ['go vote', 'go-to'],
  ['投票に行く', 'go-to'],
  ['選挙に行く', 'go-to'],
  ['still running', 'working-status'],
];

describe('Voice atoms CCCX — election & ballot-end idioms', () => {
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
