// Voice atoms CCXCVIII: EN retirement/aged-out idioms + JA 引退/隠居/退役/養老 chains (pass CCXCVIII)
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ title: 'Example Page', url: 'https://example.com' }),
    closeTab: () => {},
    tabs: [{ title: 'Example Page' }],
  });
  return vc;
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

const closeTab = [
  // --- pasture / retirement / aged-out ---
  'out to pasture', 'pasture it', 'early retirement', 'forced retirement',
  'mandatory retirement', 'golden handshake it', 'pension it',
  'send it to the retirement home', 'retirement home for it',
  'old folks home', 'send it to the old folks home', 'send it to the home',
  'send it to a home', 'put it in a home', 'senior citizen tab',
  'its too old for this', 'over the hill tab', 'long in the tooth',
  'grey around the muzzle', 'wizened and done', 'washed out',
  'washed up tab', 'has-been tab', 'yesterdays paper', 'ancient history it',
  'relic it', 'museum piece it', 'put it in a museum', 'send it to the museum',
  'museum it', 'cold storage it', 'mothballed', 'mothball fleet it',
  'decommissioned', 'deactivated', 'retire the ship', 'drydock it',
  'dry dock it', 'scuttle the ship', 'ship it off to pasture',
  'out to pasture it goes',
];

const closeTabJa = [
  // --- 引退/隠居/退役 ---
  '引退させて', '引退にして', '隠居させて', '隠居にして', '隠居でいい',
  '引き際だ', '引き際にして', '引き際を見ろ', '退役させて', '退役にして',
  '現役を退いて', '現役退場', '現役引退', '選手生命を終えて', '選手生命終了',
  '養老先生', '養老院へ', '老人ホームへ', '老人ホーム送り', '施設に入れて',
  '余生を送らせて', '余生にして', 'お払い箱にして', '用済みにして',
  '年寄りは引っ込め', '老害は退け', '休ませてやれ', '退役軍人だ',
  // --- 退職/辞職/寿退社 ---
  '寿退社して', '寿退社だ', '勇退して', '勇退だ', '退官して', '退官だ',
  '退職させて', '退職にして', '早期退職', '定年退職', '定年だ', '定年にして',
  '退任させて', '退任だ', '辞職させて', '辞職だ',
  // --- 除籍/脱退/卒業 ---
  '除隊させて', '除隊だ', '除籍して', '除名して', '名簿から消して',
  '籍を抜いて', '在籍終了', '退団させて', '脱退させて', '退会させて',
  '脱会だ', '卒業させて', '卒業だ', '卒業にして', '旅立ちを促して',
  // --- 陳腐/旧世代 ---
  '昔の人だ', '過去の人', '遅れてる', '時代遅れ', '時代遅れにして',
  '旧世代', '前の世代', '型落ち', '型落ちにして', '陳腐', '陳腐化',
  '陳腐にして', '化石', '化石にして', '骨董品', '骨董品にして', '骨董入り',
  '年代物', '年代物にして', '前時代的', '前時代的にして', '古典にして',
  // --- 紙/文書処分 ---
  '故紙にして', '紙くずにして', '紙切れにして', 'くしゃくしゃ丸めて',
  '紙吹雪にして', '古紙回収', '古紙に出して', '資源ゴミ', '燃える紙',
  '書類を捨てて', '書類処分', '機密文書処分', '帳簿を焼いて', '公文書破棄',
];

describe('Voice atoms CCXCVIII — retirement/aged-out idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
});

describe('established pins kept', () => {
  test('"老体に鞭打たせるな" -> negate (explicit negation)', () => {
    expect(key(makeVC(), '老体に鞭打たせるな')).toBe('negate');
  });
});

describe('null pins (intransitive self-retirement, not disposal)', () => {
  test.each([['隠居する'], ['引退する'], ['退役する'], ['卒業する'],
    ['隠居した'], ['引退した'], ['im retired'], ['i will retire'],
  ])('"%s" stays null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
});
