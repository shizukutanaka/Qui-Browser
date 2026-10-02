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
  // book / reading end
  'finished the book', 'book finished', 'last page turned',
  'closed the book', 'put the book down', 'bookmark placed',
  'chapter done', 'finished the chapter', 'three chapters in',
  'made it to the epilogue', 'epilogue done', 'the ending',
  'good book finished', 'returned the book', 'library book returned',
  'shelved the book', 'reading streak kept',
  // homework / assignments
  'homework done', 'homework finished', 'finished homework',
  'assignment done', 'turned in the assignment', 'handed in homework',
  'problem set done', 'pset done', 'worksheet done',
  'essay done', 'essay submitted', 'paper done', 'paper submitted',
  'turned in the paper',
  // thesis / research
  'thesis submitted', 'dissertation done', 'thesis defended',
  'defense passed', 'dissertation defended', 'defended the thesis',
  'research done', 'lit review done', 'literature review done',
  'abstract written', 'appendix done', 'bibliography done',
  'citations done', 'draft done', 'final draft submitted',
  'manuscript submitted', 'peer review done', 'revisions done',
  'resubmitted', 'accepted for publication', 'paper accepted',
  'journal submission done', 'conference paper done', 'poster done',
  'experiment done', 'data collected', 'analysis done',
  'report written', 'report submitted', 'write up done',
  'write-up submitted', 'research log closed', 'lab notebook closed',
  // study session
  'notes taken', 'flashcards done', 'memorized the deck',
  'reviewed notes', 'revision done', 'cramming done', 'studied enough',
  'study session over', 'study done', 'finished studying',
  'closed the textbook', 'textbook closed', 'workbook done',
  'exercise done', 'practice problems done', 'practice done',
  // course / lecture
  'watched the tutorial', 'lecture watched',
  'lecture done', 'course finished', 'course complete',
  'module done', 'lesson done', 'unit done', 'section done',
  'quiz done', 'passed the quiz', 'mock exam done',
  'practice test done', 'certification earned', 'cert done',
  'degree earned',
  // presentation prep
  'slides done', 'deck finished', 'presentation ready',
  'rehearsed the talk', 'talk rehearsed', 'speech memorized',
  'lines memorized',
];
const closeTabJa = [
  // 読書
  '読書終了', '本を読み終えて', '最後のページを読んで',
  '終わりまで読んで', 'あとがきを読んで', 'エピローグを読んで',
  '一章終了', '章を終えて', '三冊読んで', '返却しました',
  '本を返して', '図書館に返して', '読書記録をつけて',
  '積読を消化して',
  // 勉強/宿題
  '勉強終了', '勉強が終わって', '宿題終了', '宿題が終わって',
  '宿題を出して', '課題を出して', '課題提出', 'レポート提出',
  'レポートを出して', '小論文を出して',
  // 論文/研究
  '論文提出', '論文を書き終えて', '修論を出して', '卒論を出して',
  '博論を出して', '論文が受理されて', 'アクセプト',
  '査読が終わって', '査読を終えて', 'リバイスを出して',
  'カメラレディを出して', '学会発表終了', 'ポスター発表終了',
  '抄録を書いて', '参考文献を整理して', '引用を直して',
  '付録をつけて', '推敲終了', '原稿を仕上げて', '入稿',
  '実験終了', 'データを取って', '解析終了', '考察を書いて',
  '研究ログを閉じて', 'ゼミ終了', 'ゼミを出て', '輪読終了',
  // 問題集/暗記
  '問題集を解き終えて', 'ドリル終了', 'ワーク終了',
  '反復練習終了', '暗記終了', '単語を覚えて', '単語帳を閉じて',
  '参考書を閉じて', '教科書を閉じて', 'ノートを閉じて',
  'まとめノート完成', '写経終了', '音読終了', '精読終了',
  '速読終了', '多読終了',
  // 講義/コース
  '講義終了', '講義を聞き終えて', '授業動画を見て',
  'チュートリアル終了', 'オンライン講座終了', 'コース終了',
  '単元終了', 'セクション終了', '小テスト終了', 'クイズ終了',
  '模試終了', '模擬試験終了', '過去問を解いて', '赤本を終えて',
  '資格試験終了', '検定終了', '資格を取って', '合格しました',
  '学位を取って', '修了しました', '卒業しました',
  // 学習時間/場所
  '復習終了', '予習終了', '自習終了', '夜更かしして勉強して',
  '徹夜勉強終了', 'ラストスパート', '詰め込み終了',
  '勉強会終了', '読書会終了', 'もくもく会終了', '自習室を出て',
  '図書館を出て', '塾を出て', '予備校を出て', '家庭教師終了',
];
const negate = [
  'もう一章読んで', 'まだ読書中', 'まだ勉強中か', 'あと少し読んで',
];
const nullPins = [
  // in-progress / scheduled / bare nouns
  'reading now', 'at the library', 'in the middle of the book',
  'book club tonight', 'homework due', 'halfway through',
  'page hundred',
  '勉強中', '宿題中', '試験前日', '来週レポート', '本を読んで',
  '図書館にいる', '塾にいる', '半分読んで', '途中まで読んで',
];
const establishedPins = [
  // close-tab pins
  ['story over', 'close-tab'], ['book returned', 'close-tab'],
  ['back on the shelf', 'close-tab'], ['assignment submitted', 'close-tab'],
  ['drills done', 'close-tab'], ['graduated', 'close-tab'],
  ['本を閉じて', 'close-tab'], ['本棚に戻して', 'close-tab'],
  ['脱稿', 'close-tab'],
  // other atoms win
  ['done reading', 'reader-progress'], ['read the whole thing', 'read-aloud'],
  ['keep studying', 'negate'], ['keep reading', 'resume-reading'], ['still reading', 'speaking-status'],
  ['exam tomorrow', 'date'], ['読了', 'reader-progress'],
  ['読書中', 'reader-progress'], ['栞を挟んで', 'bookmark-page'],
  ['勉強を続けて', 'negate'], ['明日試験', 'defer'],
];

describe('pass CCCXXXVII: reading/study/homework end idioms (ginkgo)', () => {
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
