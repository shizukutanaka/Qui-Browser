// Voice atoms CCCI: EN publishing/press + photography idioms + JA 絶版/廃刊/校了/暗室 chains (pass CCCI)
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
  // --- press stop / kill the story ---
  'stop the presses', 'hold the presses', 'kill the story',
  'spike it', 'spike the story', 'blue-pencil it', 'strike the story',
  'pull the story', 'issue a retraction', 'retracted', 'kill fee',
  'spiked', 'squelch the story', 'cross it out', 'x it out',
  'strike it through', 'blue pencil it', 'mark it for deletion',
  'redact it', 'blacked out', 'censor it', 'bowdlerize it',
  'bleep it', 'bleep it out', 'expunge it', 'kill the column',
  'cancel the column', 'drop the column', 'axed the column',
  'editor killed it', 'kill the paragraph', 'cut the paragraph',
  'cut that from the story',
  // --- print run over / out of print ---
  'final edition', 'last edition', 'press run done', 'print run over',
  'stop the run', 'end of the run', 'out of print', 'out-of-print',
  'remainder it', 'remaindered', 'pulp it', 'pulped', 'to the pulper',
  'recycle the paper', 'fold the paper', 'fold the newspaper',
  'last issue', 'final issue', 'end of the issue', 'cease publication',
  'stop publication', 'suspend publication', 'print it no more',
  'ink ran dry', 'ink dried', 'out of ink', 'press is off',
  'ceased publication', 'went out of print', 'off the newsstand',
  // --- book end ---
  'shut the book', 'end of the book', 'final page',
  'the epilogue', 'epilogue reached', 'acknowledgments reached',
  'the acknowledgments', 'the back cover', 'dust jacket it',
  'shelve the book', 'return the book', 'due back', 'finis',
  'the colophon', 'the end matter', 'appendix reached',
  // --- photography / darkroom ---
  'film ended', 'end of the roll', 'roll finished', 'out of film',
  'exposed roll', 'overexposed', 'double exposed it', 'ruined the shot',
  'last frame', 'final frame', 'that was the last shot',
  'cut the negative', 'shred the negative', 'burn the negative',
  'darkroom done', 'lights off in the darkroom', 'stop bath it',
  'shutter closed', 'close the shutter', 'lens cap on', 'cap the lens',
  'cover the lens', 'aperture closed', 'iris closed', 'iris out',
  'fade to black', 'fade out', 'cut to black', 'smash cut to black',
  'black frame', 'end of the reel', 'reel ended', 'final reel',
  'film it and forget it', 'wrap the shot', 'thats a picture wrap',
];

const closeTabJa = [
  // --- 絶版/廃刊/終刊 ---
  '絶版', '絶版にして', '廃刊', '廃刊にして', '休刊', '休刊にして',
  '最終号', '最終号です', '終刊', '終刊号', '刊行終了', '出版終了',
  '印刷終了', '印刷を止めて', '印刷停止', '製版を止めて',
  '輪転機を止めて', '校了', '校了です', '校了しました', '最終校正',
  '赤入れ完了', '訂正記事', '取り消し記事', '撤回記事',
  '記事を殺して', '記事をボツにして', 'ボツにして', 'ボツ',
  '没にして', '没原稿', 'ボツ原稿', 'スパイクして', '掲載中止',
  '掲載取り下げ', '掲載を見送って', 'お蔵入り', 'お蔵入りにして',
  '日の目を見ない', '紙面を畳んで', '新聞を畳んで', '夕刊終わり',
  '最終版', '最終版面', '版を閉じて', '活版を解体して',
  'ゲラを捨てて', 'ゲラ刷りを捨てて', '紙屑にして', '資源回収に出して',
  // --- 書籍/返本 ---
  'エピローグ', 'あとがき',
  '背表紙を閉じて', '装丁を外して', '返本して', '書架に戻して',
  '絶版本', '古書にして', '古本にして', '古本屋に売って',
  '断裁して', '裁断して', 'ばらして', '綴じを解いて',
  '製本を解いて', '重版打ち止め', '増刷なし', '出版を取りやめて',
  // --- 筆記/執筆終了 ---
  '筆を折る', '筆を置いて', 'ペンを置いて', 'ペンを下ろして',
  '筆記を終えて', '書き終えて', '執筆終了', '脱稿',
  '脱稿しました', '原稿を締めて', '締め切り', '締め切りだ',
  '締切', '完筆', '完稿', '書き上げて', '仕上げて',
  // --- 写真/暗室 ---
  'フィルム終了', 'フィルムが終わった', 'ロール終わり',
  '現像を終えて', '暗室を閉めて', '暗室作業終わり',
  '印画紙を捨てて', 'ネガを捨てて', 'ネガを焼いて',
  'フィルムを焼いて', '露光しすぎ', '二重露光', '感光しちゃった',
  '感光させちゃった', 'シャッターを閉めて', 'シャッターが閉まった',
  'レンズキャップをして', 'キャップをかぶせて', 'レンズを覆って',
  '絞りを閉じて', '虹彩を閉じて', 'フィルムを巻き取って',
  '巻き上げて', '撮り終えて', '撮影終了', '撮影終わり',
  'クランクアップ', 'オールアップ', '編集終了', 'ポスプロ終わり',
  '最終カット', 'カット割り終わり', 'フェードアウト', '暗転',
  '暗転して', '真っ暗にして', 'フェードしてブラック',
];

const negate = [
  'keep the presses rolling', 'keep printing', 'stay in print',
  'still in print', 'keep the book open', '筆を折らないで',
  '執筆を続けて', '連載を続けて', '撮り続けて', '刊行を続けて',
];

const nullPins = [
  'develop the film', 'hot off the press', 'read it cover to cover',
  'page one', 'the first chapter', '現像して',
  '印刷中', '連載中', '撮影中', '書いている途中', '未定稿',
  '重版出来', '第二版',
];

const establishedPins = [
  ['last page', 'scroll-bottom'],
  ['最後のページ', 'scroll-bottom'],
  ['最終ページ', 'scroll-bottom'],
  ['しおりを挟んで', 'bookmark-page'],
  ['筆を折らないで', 'negate'],
];

describe('Voice atoms CCCI — publishing/photography idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
});

describe('negate pins (keep in print / keep shooting)', () => {
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
});

describe('null pins (process continues, no disposal)', () => {
  test.each(nullPins.map((p) => [p]))('"%s" stays null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
});

describe('established pins', () => {
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k) => {
    expect(key(makeVC(), p)).toBe(k);
  });
});
