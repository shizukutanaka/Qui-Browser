// Pass CCXLV: EN swipe/ui-gesture + end-of-shift + memory-reclaim + dispatch verbs; JA shop-close/business-end + funeral + mercy + kill-noun chains (pass CCXLV)
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

function mk() {
  const t1 = { id: 1, url: 'https://a.example', title: 'Tab A', loading: false };
  const t2 = { id: 2, url: 'https://b.example', title: 'Tab B', loading: false };
  const t3 = { id: 3, url: 'https://c.example', title: 'Tab C', loading: false };
  const tabManager = {
    tabs: [t1, t2, t3], activeTab: t2, activeTabId: 2,
    getActiveTab() { return this.activeTab; },
    getTab(id) { return this.tabs.find(t => t.id === id); },
  };
  const vc = new VoiceCommands({
    speak: () => {},
    onCommand: () => {},
  });
  vc.connectBrowser(tabManager);
  return vc;
}
function key(vc, p) {
  vc.processCommand(p, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('pass CCXLV: close-tab coverage', () => {
  test.each([
    "swipe it away", "swipe it off", "swipe it left", "swipe it right",
    "swipe it up", "swipe it down", "swipe it closed", "swipe it shut",
    "swipe it out", "swipe the tab away", "swipe the tab off", "swipe the tab left",
    "swipe the tab right", "swipe the tab up", "swipe the tab down", "swipe the tab closed",
    "swipe the tab shut", "swipe the tab out", "drag it off", "drag it away",
    "pull it off screen", "pull it offscreen", "slide it off", "slide it away",
    "slide the tab off", "toss it offscreen", "offscreen it", "off the screen it goes",
    "press the x", "press x", "hit the x", "click the x",
    "tap the x", "hit x", "press the close button", "click close",
    "click the close button", "press close", "tap close", "hit close",
    "smash the x", "press that x", "x button it", "x out of it",
    "divide it by zero", "zero it", "subtract it", "subtract the tab",
    "minus it", "minus the tab", "delete it from the set", "remove it from the set",
    "out of the set", "exclude it", "exclude the tab", "tear down the tab",
    "pull it down now", "torn down", "level the tab", "knock it off the map",
    "erase it from the map", "off the map it goes", "closing time for it", "done for the day",
    "done for today", "quitting time", "quitting time for it", "punch out",
    "clock out", "end of shift", "shift over", "duty done",
    "mission complete", "mission accomplished", "objective complete", "task complete",
    "task completed", "job done", "job done for it", "work done",
    "all done", "all done with it", "done and done", "done deal",
    "done and dusted", "case closed", "matter closed", "close the book",
    "shut the book", "slam the book shut", "file closed", "close the file",
    "cut the music", "stop the music", "end the show", "close the show",
    "shut down the show", "fade out", "fade to black", "cut to black",
    "final bow", "forfeit it", "forfeit the tab", "tap out",
    "tap the tab out", "count the tab out", "down and out", "out for the count",
    "over n out", "end transmission", "end of transmission", "attic for it",
    "file it away for good", "box it", "box the tab up", "maroon it",
    "maroon the tab", "castaway it", "silver bullet the tab", "stake it through the heart",
    "double tap it", "double tap the tab", "shoot it in the head", "bash it",
    "bash the tab", "bash its skull in", "cave it in", "implode it",
    "implode the tab", "implosion for it", "yank the plug", "short out the tab",
    "cease and desist", "put a lid on it", "cork it", "plug it",
    "button it", "zip it up", "tie off the tab", "red pen it",
    "blue pencil it", "edit it out", "edit the tab out", "cut it from the script",
    "off the script", "cross it through", "line it through", "scram it",
    "skiddoo", "shove off the tab", "buzz off the tab", "fly away tab",
    "sashay away", "detach it", "detach the tab",
    "detach it now", "disengage it", "disengage the tab", "unhook it",
    "unhook the tab", "unmount it", "unmount the tab", "deregister it",
    "deregister the tab", "delist it", "delist the tab", "unlist it",
    "unlist the tab", "strike it off the list", "off the list", "cross it off the list",
    "scratch it off the list", "drop it from the list", "off the roster", "drop it from the roster",
    "off the rolls", "strike it off the rolls", "wipe it off the books", "off the record",
    "out of the record", "wipe it from memory", "purge it from memory", "clear it from memory",
    "evict it from memory", "free up the memory", "reclaim the memory", "reclaim it",
    "reclaim the tab", "garbage collect it", "gc it", "run gc",
    "collect it", "collect the tab", "draw stumps", "pull stumps",
    "pull the stumps", "stumps pulled", "閉店だ", "閉店する",
    "閉店しろ", "閉店の時間だ", "閉店時間だ", "本日は閉店",
    "本日閉店", "閉店準備", "営業終了だ", "営業終了",
    "本日の営業は終了", "営業を終了する", "営業を終える", "打ち止めだ",
    "打ち止め", "終業だ", "終業時間だ", "退勤だ",
    "退勤の時間だ", "仕事終わりだ", "仕事終了だ", "業務終了だ",
    "業務終了の時間だ", "事業終了だ", "廃業だ", "廃業する",
    "廃業届け", "倒産だ", "倒産する", "倒産した",
    "破産だ", "破産した", "破産宣告", "永眠させろ",
    "永眠させて", "見送れ", "見送って", "見送るんだ",
    "送り出せ", "送り出して", "消火せよ", "鎮火せよ",
    "鎮火させろ", "鎮火だ", "水をかけろ", "水をぶっかけろ",
    "水を掛けて", "閉幕の時間だ", "幕引きしろ", "幕引きの時間だ",
    "大団円だ", "大団円を迎えた", "ラストだ", "ラストシーンだ",
    "ラストを迎えた", "フィナーレだ", "フィナーレを迎えた", "エンディングだ",
    "エンディングを迎えた", "エピローグだ", "エピローグを迎えた", "これで終わりだ",
    "これが最後だ", "これが最後です", "これが最後の姿だ", "最後だ",
    "最後です", "見納めだ", "見納めです", "見納めの時だ",
    "見納めの時間だ", "放棄しろ", "放棄だ", "放棄するんだ",
    "放棄せよ", "放棄すべき", "放棄すべきだ", "弔え",
    "弔って", "弔うんだ", "鎮めろ", "鎮めて",
    "鎮魂せよ", "鎮魂だ", "手向けろ", "手向けて",
    "瞑れ", "瞑って", "死んだ", "死んだぞ",
    "死んだよ", "死んだわ", "死んだんだ", "死にました",
    "死にましたよ", "死にましたので", "死亡した", "死亡だ",
    "死亡確認", "死亡診断", "死亡届", "絶命した",
    "息絶えた", "息絶えたぞ", "息の根止めて", "楽にしてやれ",
    "楽にしてあげて", "苦しみから解放しろ", "苦しみから解放して", "解放してやれ",
    "解放してあげて", "楽にしてやってくれ", "苦痛を終わらせろ", "痛みを終わらせろ",
    "苦しみを終わらせろ", "人生終わりだ", "人生終了だ", "退場させられろ",
    "殺してしまって", "殺さなければならぬ", "殺すしかなかろう", "殺す決定だ",
    "殺す決断だ", "殺す覚悟だ", "殺す覚悟を決めた", "殺すと決めました",
    "殺すと決断した", "殺すと判断した", "殺すと判断しました", "殺すとの判断だ",
    "殺すとの見解だ", "殺すとの結論だ", "殺すとの答えだ", "殺すという件だ",
    "殺すという話だ", "殺すという方針だ", "殺すという決定だ", "殺すという所存だ",
    "殺すという意向だ", "殺すという意志だ", "殺すという旨だ", "殺すという次第だ",
    "殺すというお達しだ", "殺すという沙汰だ", "殺すという由だ", "殺すという命令だ",
    "殺すという指示だ", "殺すという宣告だ", "殺すという布告だ", "殺すという判決だ",
    "殺すという裁定だ", "殺すと命じた", "殺すと命令した", "殺すと指示が出た",
    "殺すと指示された", "殺すと決まった", "殺すと採決した", "殺すと議決した",
    "殺すと可決した", "殺せと言っている", "殺せと言ったろう", "殺せと言ってるんだ",
    "殺せと命令する", "殺せと命じる", "殺せと命じた", "殺せとの命令だ",
    "殺せとの指示だ", "殺せとの指示です", "殺してと頼んだ", "殺してと頼む",
    "殺してと頼みます", "殺してとお願いした", "殺してとお願いします", "殺すと思うんだ",
    "殺すと考える", "殺すと考えます", "殺すと判断する", "殺すと決める",
    "殺すと決めます", "殺すとする", "殺すとします", "殺すのが筋だ",
    "殺すのが正解だ", "殺すのが正解だと思う", "殺すのが妥当だ", "殺すのが順当だ",
    "殺すのが順当だと思う", "殺すのが最善だ", "殺すのが最善だと思う", "殺すのが上策だ",
    "殺すのが上策だと思う", "殺すのが本懐だ", "殺すのが本懐だと思う", "殺すのが勝ちだ",
    "殺すのが勝ちだと思う", "殺すのが正義だ", "殺すのが正義だと思う", "殺すのが仕様だ",
    "殺すのが仕様だと思う",
  ])('routes %s to close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});

describe('pass CCXLV: vr-exit coverage', () => {
  test.each([
    "さらばだ", "おさらばだ", "おさらばです",
  ])('routes %s to vr-exit', (p) => {
    expect(key(mk(), p)).toBe('vr-exit');
  });
});
