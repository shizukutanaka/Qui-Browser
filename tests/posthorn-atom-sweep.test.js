// pass DCCXXV: language exams, interpretation & translation
// certifications -> close-tab
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const t1 = { id: 1, url: 'https://a.example', title: 'Tab A', loading: false };
  const t2 = { id: 2, url: 'https://b.example', title: 'Tab B', loading: false };
  const vc = new VoiceCommands({
    speak: () => {},
    onCommand: () => {}
  });
  vc.connectBrowser({
    getActiveTab: () => t1,
    closeTab: () => {},
    tabs: () => [t1, t2]
  });
  return vc;
}

const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

describe('pass DCCXXV: language & translation certifications (posthorn)', () => {
  const closeTab = ['translator certified', 'interpreter sworn', 'language instructor licensed'];
  const closeTabJa = [
    '英語検定',
    '英検',
    '英検一級',
    '英検準一級',
    '英検二級',
    '英検準二級',
    '英検三級',
    '英検四級',
    '英検五級',
    'toeic',
    'toeic試験',
    'toeic公開テスト',
    'toeic900点',
    'toeicスコア',
    'toefl',
    'toefl試験',
    'toefl点',
    'ielts',
    'ielts試験',
    'teap',
    'gtec',
    'ケンブリッジ英検',
    '児童英検',
    '国連英検',
    '語学検定',
    '外国語検定',
    '日本語能力試験',
    'jlpt',
    'n1合格',
    'n2合格',
    'n3合格',
    '漢字検定',
    '漢検',
    '漢検一級',
    '漢検準一級',
    '漢検二級',
    '漢検準二級',
    '漢検三級',
    '漢字能力検定',
    '日本語検定',
    '作文検定',
    '文章検定',
    '速記検定',
    'タイピング検定',
    'ビジネス文書検定',
    'ビジネス実務検定',
    '秘書検定',
    '秘書検定一級',
    '秘書検定二級',
    '秘書技能検定',
    'マナー検定',
    '接客検定',
    '電話応対検定',
    'ビジネスマナー',
    '敬語',
    '敬語検定',
    'コミュニケーション検定',
    '通訳案内士',
    '全国通訳案内士',
    '通訳案内士試験',
    '通訳ガイド',
    '通訳案内士登録',
    '通訳案内業',
    '通訳',
    '通訳者',
    '会議通訳',
    '同時通訳',
    '逐次通訳',
    'ウィスパリング',
    'ビジネス通訳',
    '医療通訳',
    '司法通訳',
    'コミュニティ通訳',
    '通訳士検定',
    '翻訳者',
    '翻訳検定',
    '翻訳実務検定',
    '産業翻訳',
    '実務翻訳',
    '文学翻訳',
    '映像翻訳',
    '字幕翻訳',
    '法律翻訳',
    '特許翻訳',
    '医薬翻訳',
    '金融翻訳',
    'it翻訳',
    'ローカライズ',
    '翻訳支援ツール',
    'catツール',
    '翻訳メモリ',
    '用語集管理',
    '翻訳会社',
    '翻訳家',
    '訳書',
    '重訳',
    '抄訳',
    '全訳',
    '対訳',
    '逐語訳',
    '意訳',
    '直訳',
    '日本語教師',
    '日本語教師検定',
    '日本語教育能力検定',
    '日本語教育',
    '日本語学校',
    '日本語教員',
    '日本語指導',
    'ひらがな指導',
    '漢字指導',
    '会話練習',
    'にほんご教室',
    '日本語ボランティア',
    '留学生指導',
    'esj',
    '日本語学校認定',
    '中国語検定',
    '中検',
    '中国語検定一級',
    '韓国語能力試験',
    'topik',
    'ハングル検定',
    'フランス語検定',
    '仏検',
    'ドイツ語検定',
    '独検',
    'スペイン語検定',
    '西検',
    'イタリア語検定',
    '伊検',
    'ロシア語能力検定',
    'ポルトガル語検定',
    'ベトナム語能力認定',
    'タイ語検定',
    'アラビア語検定',
    'インドネシア語検定',
    '外国語学部',
    '語学留学',
    '留学試験',
    '交換留学',
    '語学研修',
    'ホームステイ',
    '海外研修',
    '語学学校',
    '留学エージェント',
    '留学カウンセラー',
    'sat試験',
    'gre試験',
    'ieltsライティング',
    'speaking評価',
    'リスニングスコア'
  ];
  const negate = [
    'still awaiting the interpreter license',
    'still awaiting the language exam',
    'まだ試験結果前',
    'まだ受験前',
    'これから受験',
    'まだ合格発表前'
  ];
  const nullPins = ['about to visit the test center', 'about to file the exam report'];
  const establishedPins = [
    ['質流れ', 'close-tab'],
    ['骨董品', 'close-tab'],
    ['close this tab', 'close-tab'],
    ['keep it', 'negate'],
    ['leave it alone', 'negate']
  ];

  let vc;
  beforeEach(() => {
    vc = makeVC();
  });

  closeTab.forEach((p) => test(`close-tab: "${p}"`, () => expect(key(vc, p)).toBe('close-tab')));
  closeTabJa.forEach((p) => test(`close-tab JA: ${p}`, () => expect(key(vc, p)).toBe('close-tab')));
  negate.forEach((p) => test(`negate: "${p}"`, () => expect(key(vc, p)).toBe('negate')));
  nullPins.forEach((p) => test(`still null: "${p}"`, () => expect(key(vc, p)).toBeNull()));
  establishedPins.forEach(([p, k]) => test(`pin: "${p}" still -> ${k}`, () => expect(key(vc, p)).toBe(k)));
});
