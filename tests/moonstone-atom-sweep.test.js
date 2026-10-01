/**
 * pass CCLXXVII — third cross-command breadth sweep: pause/stop-reading,
 * video-toggle/stop, find-in-page/next/prev, speech rate, volume-down,
 * reader-size-down, next/prev-page, done-declaratives, negate.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVc() {
  const tabs = [
    { id: 1, url: 'https://a.example', title: 'Tab A', loading: false },
    { id: 2, url: 'https://b.example', title: 'Tab B', loading: false },
  ];
  const tabManager = {
    tabs,
    activeTabId: 2,
    getActiveTab() { return tabs[1]; },
    getTab(id) { return tabs.find((t) => t.id === id); },
  };
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tabManager);
  return vc;
}

function key(phrase) {
  const vc = makeVc();
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

const cases = [
  // pause-reading
  ['読み上げ一時停止', 'pause-reading'],
  ['一旦読むの止めて', 'pause-reading'],
  ['読むの一休み', 'pause-reading'],
  ['読み上げとめて', 'pause-reading'],
  ['ナレーション止めて', 'pause-reading'],
  ['hold the reading', 'pause-reading'],
  ['hold up on reading', 'pause-reading'],
  ['pause the reading', 'pause-reading'],
  ['pause it', 'pause-reading'],
  // stop-reading
  ['読むの止めて', 'stop-reading'],
  ['読むのをやめて', 'stop-reading'],
  ['stop reading it', 'stop-reading'],
  ['stop narrating', 'stop-reading'],
  // video
  ['pause the video', 'video-toggle'],
  ['play the video', 'video-toggle'],
  ['resume the video', 'video-toggle'],
  ['動画を再生して', 'video-toggle'],
  ['ビデオ再生', 'video-toggle'],
  ['動画一時停止', 'video-toggle'],
  ['再生して', 'video-toggle'],
  ['動画止めて', 'video-stop'],
  ['ビデオ止めて', 'video-stop'],
  ['動画を止めて', 'video-stop'],
  ['stop the video', 'video-stop'],
  ['mute the video', 'mute-toggle'],
  ['動画の音消して', 'mute-toggle'],
  // find-in-page
  ['このページを検索', 'find-in-page'],
  ['search in page', 'find-in-page'],
  ['文中を検索して', 'find-in-page'],
  ['look for the word test', 'find-in-page'],
  ['ページ内検索して', 'find-in-page'],
  // find-next
  ['find the next one', 'find-next'],
  ['go to next result', 'find-next'],
  ['次の結果', 'find-next'],
  ['ひとつ次', 'find-next'],
  ['next match please', 'find-next'],
  ['jump to next match', 'find-next'],
  // find-prev
  ['前のを探して', 'find-prev'],
  ['go back a match', 'find-prev'],
  ['previous match please', 'find-prev'],
  // speech rate
  ['a little faster', 'speech-faster'],
  ['もう少し速く', 'speech-faster'],
  ['ちょっと速くして', 'speech-faster'],
  ['a little slower', 'speech-slower'],
  ['もう少しゆっくり', 'speech-slower'],
  ['ゆっくり話して', 'speech-slower'],
  // volume-down
  ['ボリューム下げて', 'volume-down'],
  ['ボリュームさげて', 'volume-down'],
  ['音量下げてちょうだい', 'volume-down'],
  ['turn it down a bit', 'volume-down'],
  ['a notch lower', 'volume-down'],
  ['down a notch', 'volume-down'],
  ['音ちょっと小さく', 'volume-down'],
  ['ちょっと下げて音量', 'volume-down'],
  // reader-size-down
  ['ちょっと小さく', 'reader-size-down'],
  ['文字ちょっと小さく', 'reader-size-down'],
  ['make it smaller', 'reader-size-down'],
  // next-page
  ['page over', 'next-page'],
  ['flip forward', 'next-page'],
  ['めくって次', 'next-page'],
  ['次のページいって', 'next-page'],
  ['turn the page', 'next-page'],
  ['flip it over', 'next-page'],
  // prev-page
  ['page back', 'prev-page'],
  ['前のページいって', 'prev-page'],
  ['ページを戻して', 'prev-page'],
  // close-tab done-declaratives
  ['this one is done', 'close-tab'],
  ['im finished with this', 'close-tab'],
  ['done with this page', 'close-tab'],
  // negate
  ['このタブいらない', 'negate'],
  // pins kept
  ['もうちょっと小さく', 'panel-distance'],
  ['ページを進めて', 'navigate'],
];

describe('pass CCLXXVII moonstone atom sweep', () => {
  test.each(cases)('%s -> %s', (phrase, want) => {
    expect(key(phrase)).toBe(want);
  });
});
