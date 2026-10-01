/**
 * pass CCLXXIX — fifth cross-command breadth sweep: captions/contrast/
 * brightness/recenter/panel/mic/sleep/help/tab-select/reopen/vr-exit.
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
  // captions-toggle
  ['キャプションつけて', 'captions-toggle'],
  ['字幕つけて', 'captions-toggle'],
  ['キャプションオン', 'captions-toggle'],
  ['キャプションオフ', 'captions-toggle'],
  ['hide the captions', 'captions-toggle'],
  ['show the captions', 'captions-toggle'],
  ['字幕隠して', 'captions-toggle'],
  // high-contrast / brightness
  ['コントラスト上げて', 'high-contrast'],
  ['コントラストを上げて', 'high-contrast'],
  ['暗くして画面', 'brightness'],
  ['画面暗くして', 'brightness'],
  // recenter / panel-distance
  ['中心に戻して', 'recenter'],
  ['画面を正面に', 'recenter'],
  ['パネル近づけて', 'panel-distance'],
  ['画面近づけて', 'panel-distance'],
  ['パネル遠ざけて', 'panel-distance'],
  ['もっと近く', 'panel-distance'],
  // mic stop / mic-on
  ['マイク切って', 'stop'],
  ['マイクを切って', 'stop'],
  ['turn the mic off', 'stop'],
  ['マイクつけて', 'mic-on'],
  ['turn the mic on', 'mic-on'],
  ['unmute the mic', 'mic-on'],
  // sleep / wake-word
  ['寝てもいいよ', 'sleep-mode'],
  ['ウェイクワード教えて', 'wake-word-status'],
  // help / time / online
  ['ヘルプ表示して', 'help'],
  ['時刻教えて', 'time'],
  ['オンラインか確認', 'online-status'],
  ['接続状態教えて', 'online-status'],
  // first/last tab + ordinal
  ['最初のタブ開いて', 'first-tab'],
  ['最初のタブにして', 'first-tab'],
  ['最後のタブにして', 'last-tab'],
  ['三つ目のタブ', 'tab-select-ordinal'],
  ['2番目のタブ', 'tab-select-ordinal'],
  // reopen-tab
  ['閉じたタブを復活', 'reopen-tab'],
  ['閉じたタブ戻して', 'reopen-tab'],
  ['さっき閉じたやつ戻して', 'reopen-tab'],
  ['元に戻してタブを', 'reopen-tab'],
  ['消しちゃった', 'reopen-tab'],
  // vr-exit
  ['vrをやめて', 'vr-exit'],
  ['vr終了して', 'vr-exit'],
  ['leave vr', 'vr-exit'],
  ['vr抜けて', 'vr-exit'],
  ['vrを抜ける', 'vr-exit'],
  ['ヘッドセット外す', 'vr-exit'],
  // repeat-command misroute fix
  ['もう一回やって', 'repeat-command'],
  // pins kept
  ['もう一度言って', 'say-again'],
  ['mute the mic', 'stop'],
  ['起きて', 'sleep-mode'],
];

describe('pass CCLXXIX lapis2 atom sweep', () => {
  test.each(cases)('%s -> %s', (phrase, want) => {
    expect(key(phrase)).toBe(want);
  });
});
