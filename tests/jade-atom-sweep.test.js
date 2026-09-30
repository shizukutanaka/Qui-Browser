// Pass CCXLVI: EN bin/parts + funeral rites + send-off + mob-disposal + elemental-return; JA shop-closure + funeral + river-sink + quiet disposal (pass CCXLVI)
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
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tabManager);
  return vc;
}
function key(vc, p) {
  vc.processCommand(p, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('pass CCXLVI: close-tab coverage', () => {
  test.each([
    "dump it in the bin", "dump the tab in the bin", "toss it in the dumpster", "throw it in the dumpster",
    "into the bin with it", "in the bin with it", "into the trash with it", "into the skip",
    "send it to the dump", "take it to the dump", "to the dump with it", "to the tip with it",
    "rubbish it", "scrap it for parts", "part it out", "strip it for parts",
    "cannibalize it", "cannibalise it", "salvage it", "salvage the tab",
    "sell it for scrap", "sell it for parts", "down to the last piece", "strip it down",
    "strip it to nothing", "pick its bones clean", "gut it for parts", "leave nothing but bones",
    "bare the bones", "send it to pasture", "put it out to stud", "pack its bags",
    "pack it up and go", "show it out", "walk it out", "walk it to the door",
    "see it to the door", "escort it out", "escort it to the door", "usher it from the building",
    "throw it out on its ear", "dump it on the street", "put it out on the street", "out in the cold with it",
    "out on the street with it", "toss it on the heap", "toss it on the pile", "onto the scrapheap",
    "onto the junk heap", "onta the ash heap", "into the junk pile", "consign it to history",
    "consign it to oblivion", "consign it to the scrapheap", "condemnation for it", "give it last rites",
    "perform last rites", "bless it for the last time", "have a funeral for it", "hold a funeral for it",
    "have a memorial for it", "hold a memorial", "eulogize it", "deliver its eulogy",
    "say a eulogy", "say a prayer for it", "light a candle for it", "ring the funeral bell",
    "toll the bell for it", "lower the flag", "lower the flag for it", "half mast it",
    "half staff it", "fly the flag at half mast", "sound taps", "fire the salute",
    "twenty one gun salute", "three volleys for it", "plant it", "plant the tab",
    "six foot drop", "kick the bucket for it", "bought it", "bought it for it",
    "bit it", "bit it for good", "croaked it", "checked out",
    "checked out for it", "called home", "went home", "went to its maker",
    "met its end", "met its doom", "met its fate", "came to an end",
    "reached its end", "reached the end", "last stop", "final stop",
    "end of the journey", "journey over", "voyage over", "cruise over",
    "sailed away", "sailed off", "sailed into the sunset", "ride into the sunset",
    "ride off into the sunset", "walk into the sunset", "fade into the sunset", "into the sunset with it",
    "out to sea with it", "let it drift", "let it drift away", "watch it drift",
    "watch it sink", "watch it go", "watch it leave", "wave the tab goodbye",
    "blown a kiss", "air kiss it", "send it off with a kiss", "send the tab off",
    "send off for it", "see the tab off", "see it depart", "watch it depart",
    "departing it", "departed it", "departed the tab", "gone and left",
    "went and left", "turned its back", "turned its back on us", "left us for good",
    "left us", "departed this world", "left this world", "passed into history",
    "faded into history", "lost to history", "swallowed by history", "taken by time",
    "claimed by time", "lost to time", "give the tab up", "give up on it",
    "give up on the tab", "abandon it to fate", "cut it loose and let it go", "let it drift off",
    "watch it drift off", "let it sail", "let it sail away", "let it sail off",
    "float it away", "float it off", "drift it away", "drift it off",
    "drift it out", "drift the tab away", "blown it away", "blown it away for good",
    "scatter it to the wind", "scatter its ashes", "scatter the ashes", "spread its ashes",
    "spread the ashes", "ashes scattered", "spread them at sea", "scatter them at sea",
    "give it a sea burial", "bury it at sea", "buried at sea", "ocean burial",
    "sea burial", "viking send off", "viking funeral for it", "send it out in flames",
    "send it off in flames", "burning boat", "funeral pyre for it", "set the pyre ablaze",
    "torch the pyre", "burn it to the waterline", "scuttle it to the bottom", "send it down to davy jones",
    "down to davy jones", "davy jones locker it", "sleep with the fish", "sleeping with the fish",
    "put it in concrete boots", "fit it for concrete boots", "cement booties", "cement booties for it",
    "wrap it in a carpet", "rug and river", "river toss", "toss it in the river",
    "toss it in the hudson", "into the river with it", "into the hudson", "into the east river",
    "dead men tell no tales", "no witnesses", "leave no witnesses", "silence it forever",
    "gag it", "gag the tab", "muzzle it", "muzzle the tab",
    "muffle it", "muffle the tab", "stifle the tab", "smother the tab",
    "smother it with a pillow", "pillow over its face", "hold the pillow down", "ease it out",
    "ease it out the door", "ease it out of existence", "help it into the grave", "help it into eternity",
    "help it cross over", "help it cross", "walk it across", "walk it across the bridge",
    "cross the bridge for it", "cross it over", "cross it to the other side", "other side for it",
    "see it through the veil", "through the veil", "beyond the veil", "behind the curtain",
    "pull the curtain on it", "last curtain call", "final curtain call", "no curtain call",
    "no standing ovation", "no more curtain calls", "bow out of it", "bow it out gracefully",
    "graceful exit for it", "dignified exit", "quiet exit for it", "slip out quietly",
    "slip it out quietly", "slip it out the back", "out the back door", "out the back with it",
    "through the back door", "boot it out the back", "chuck it out the back", "sneak it out the back",
    "sneak it out", "smuggle it out", "smuggle the tab out", "smuggle it away",
    "smuggle it off", "pack it in the trunk", "trunk of the car", "body in the trunk",
    "wrap it in a rug", "roll it in a rug", "roll it in a carpet", "out with the rubbish",
    "out with the trash", "out with the garbage", "out with the recycling", "out with the rest",
    "out with the leftovers", "dispose of it discreetly", "discreet disposal", "quiet disposal",
    "dispose of the body", "lose the body", "dump the body", "dump the body in the lake",
    "lake dump for it", "lake it", "bottom of the lake", "deep end for it",
    "sink it in the deep end", "weigh it down", "weigh it down with stones", "chain it and sink it",
    "chain it and drop it", "attach an anchor", "tie an anchor to it", "tie a brick to it",
    "tie a stone to it", "tie rocks to it", "tie a cinder block", "cinder block shoes",
    "cinder block it", "two bricks for it", "down with the anchor", "drown it in the tub",
    "drown it in the pool", "hold it under", "hold it under the water", "hold its head under",
    "under the water with it", "underwater it", "waterboard it", "water burial",
    "give it a water burial", "plunge it under", "plunge it into the deep", "plunge it into the depths",
    "into the depths with it", "into the deep end", "into the deep blue", "into the briny deep",
    "into nothingness", "into the blackness", "into the darkness", "into the shadows",
    "into the night", "into the darkness with it", "into the night with it", "into the fog",
    "into the mist", "into the mist with it", "fade into the mist", "fade into the fog",
    "fade into darkness", "fade into the darkness", "fade into black", "fade out of existence",
    "fade out of sight", "fade from view", "fade from memory", "fade from the page",
    "slip into the shadows", "retreat into shadow", "dissolve into shadow", "melt into shadow",
    "melt into darkness", "become darkness", "become the night", "become a ghost",
    "become a memory", "become dust", "become ashes", "become nothing",
    "become the wind", "become the air", "become the mist", "become vapor",
    "become vapour", "into the ether", "into the ether with it", "into the aether",
    "release it to the ether", "release it to the elements", "release it to nature", "release it to the wind",
    "release it to the sea", "release it to the earth", "give it back to nature", "give it back to the earth",
    "return it to nature", "return it to the earth", "return it to the sea", "return it to the wind",
    "back to nature", "back to the earth", "back to the wild", "back to the sea",
    "back to the wind", "one with nature again", "one with the earth", "one with the universe",
    "one with the cosmos", "rejoin the cosmos", "rejoin the universe", "rejoin the stars",
    "return to the stars", "back to the stars", "stardust again", "become stardust",
    "to stardust", "into stardust", "cosmic return", "cosmic return for it",
    "取り壊せ", "取り壊しだ", "バラシだ", "店じまいだ",
    "店仕舞いだ", "店を閉めろ", "暖簾を下ろせ", "看板を下ろせ",
    "シャッターを下ろせ", "シャッターを閉めろ", "店じまいの時間だ", "店仕舞いの時間だ",
    "潮時だ", "見切り時だ", "見切りをつけろ", "見切り発車だ",
    "見限り時だ", "不要品だ", "粗大ごみだ", "粗大ゴミだ",
    "燃えるゴミだ", "燃えないゴミだ", "不燃ゴミだ", "資源ゴミだ",
    "ゴミだ", "ゴミ箱行きだ", "ゴミ箱に入れろ", "ゴミ箱に捨てろ",
    "ゴミに出せ", "ゴミ出しだ", "ゴミの日だ", "収集日だ",
    "回収日だ", "古紙回収だ", "廃品回収だ", "不要品回収だ",
    "リサイクルに出せ", "リサイクル行きだ", "資源にしろ", "肥料にしろ",
    "餌にしろ", "えさにしろ", "魚の餌にしろ", "犬の餌にしろ",
    "豚の餌にしろ", "鶏の餌にしろ", "肥料にしてやれ", "土にしてやれ",
    "灰にしてやれ", "塵にしてやれ", "消し炭にしてやれ", "こっぱみじんにしてやれ",
    "木っ端微塵にしてやれ", "八つ裂きにしてやれ", "千切って捨てろ", "引き裂いて捨てろ",
    "破り捨てろ", "破いて捨てろ", "捨てちまえ", "捨てちゃえ",
    "捨てときな", "捨てとけ", "捨てといていい", "捨ててもいい",
    "捨てていいぞ", "捨てていいよ", "捨てるのもありだ", "捨てるのも手だ",
    "捨てるしかない", "捨てるっきゃない", "捨てる一択だ", "捨てるのが筋だ",
    "捨てるのが正解だ", "捨てるのが妥当だ", "捨てると決めた", "捨てるとの判断だ",
    "捨てるという件だ", "捨てるという方針だ", "捨てるという決定だ", "捨てると決まった",
    "捨てると命じた", "捨てると採決した", "捨てろと言った", "捨てろと言ってる",
    "捨てろとの命令だ", "捨てろとの指示だ", "捨ててと頼んだ", "捨ててと頼む",
    "捨ててとお願いした", "捨ててとお願いする", "捨てると思う", "捨てると思います",
    "捨てると考える", "捨てると判断する", "捨てると決める", "捨てるとする",
    "他界した", "逝去した", "永眠した", "鬼籍に入った",
    "物故した", "往生した", "昇天した", "召された",
    "召されたぞ", "召されたよ", "帰らぬ人となった", "帰らぬ人だ",
    "帰らぬ人です", "あの世に行った", "あの世へ行った", "冥土に送れ",
    "冥土に送ってやれ", "三途の川を渡れ", "三途の川を渡らせろ", "三途の川へ送れ",
    "彼岸へ送れ", "葬儀だ", "葬儀をやれ", "葬儀を執り行え",
    "葬式をやれ", "葬式を挙げろ", "告別式だ", "告別式をやれ",
    "お別れ会だ", "お別れ会をやれ", "納骨だ", "納骨しろ",
    "納棺だ", "納棺しろ", "棺に納めろ", "棺桶に納めろ",
    "棺に入れてやれ", "墓穴を掘れ", "墓を掘れ", "土に埋めてやれ",
    "庭に埋めろ", "裏山に埋めろ", "山中に埋めろ", "野に埋めろ",
    "火にくべろ", "焚き火にくべろ", "焼却しろ", "焼却処分だ",
    "焼却処分しろ", "灰撒け", "散骨だ", "散骨しろ",
    "散骨してやれ", "海葬だ", "海葬にしろ", "海葬にしてやれ",
    "空葬だ", "鳥葬だ", "水葬だ", "水葬にしろ",
    "土葬だ", "土葬にしろ", "火葬してやれ", "川に捨てろ",
    "川に沈めろ", "海に捨てろ", "海に流せ", "沼に沈めろ",
    "淵に沈めろ", "底に沈めろ", "水底に沈めろ", "川底に沈めろ",
    "海底に沈めろ", "重しをつけろ", "錨をつけろ", "錨を付けて沈めろ",
    "コンクリ詰めだ", "コンクリート詰めだ", "コンクリートで固めろ", "ドラム缶詰めだ",
    "ドラム缶に詰めろ", "土に還せ", "土に還れ", "自然に還せ",
    "自然に還れ", "風に還せ", "海に還せ", "星に還せ",
    "宇宙に還せ", "塵に還れ", "灰に還れ", "無に還れ",
    "無に帰せ", "跡形もなく消えろ", "目撃者を消せ", "静かに始末しろ",
    "そっと始末しろ", "こっそり始末しろ", "内密に始末しろ", "人知れず始末しろ",
    "誰にも知られず消せ", "存在を消せ", "歴史から消せ", "記録から消せ",
    "戸籍を抜け", "世界から消せ", "地図から消せ", "俺の前から消えろ",
    "私の前から消えろ",
  ])('routes %s to close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});

describe('pass CCXLVI: negate coverage', () => {
  test.each([
    "用なしだ", "いらん", "いらんわ", "要らん",
    "要らんわ", "要らない", "要らんものだ", "不要だ",
  ])('routes %s to negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });
});

describe('pass CCXLVI: close-all-tabs coverage', () => {
  test.each([
    "店を畳め", "店を畳むんだ", "畳む時間だ", "畳み時だ",
  ])('routes %s to close-all-tabs', (p) => {
    expect(key(mk(), p)).toBe('close-all-tabs');
  });
});
