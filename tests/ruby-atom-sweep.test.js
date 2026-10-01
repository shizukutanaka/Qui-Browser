// Pass CCXLIV: EN cold-shoulder/give-the-X/delegation/free-release + ignore/acquit/mercy/keep-alive + revive literals; JA fedup/purpose-served/end-declarations (pass CCXLIV)
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

describe('pass CCXLIV: close-tab coverage', () => {
  test.each([
    "give it the cold shoulder", "cold shoulder it", "ghost it", "ghost the tab",
    "snub it", "snub the tab", "cut it dead", "cut the tab dead",
    "give it the brush off", "give it the brush", "brush off", "give it the heave ho",
    "give it the old heave ho", "heave ho", "heave ho for it", "give it the sack for real",
    "give it the ax", "give it the punt", "give it the kick", "give it the old yeller",
    "give it the gas", "give it the shaft", "give it the shove", "give it the push",
    "give it the slip", "give it the go-by", "give it the go by", "give it the go-by for good",
    "disavow the tab", "repudiate the tab", "repudiate it wholly", "forgo it",
    "forgo the tab", "forswear it", "forswear the tab", "abjure it",
    "abjure the tab", "abnegate it", "renounce the tab", "disclaim it",
    "disclaim the tab", "wash my hands of the tab", "be finished with it", "finish with it",
    "finish with the tab", "no more truck with it", "no truck with it", "no truck with the tab",
    "be quit of it", "be quit of the tab", "be shut of it", "be shut of the tab",
    "be shot of it", "be shot of the tab", "get shut of the tab", "get shot of the tab",
    "be shut of it for good", "wash my hands clean", "my hands are clean", "my hands are clean of it",
    "off my hands", "off my hands it goes", "out of my hands", "outta my hands",
    "no longer my problem", "not my problem anymore", "not my problem", "not my circus",
    "not my monkeys", "someone elses problem", "someone elses problem now", "an sep",
    "sep it", "sep field", "make it someone elses problem", "pass it off",
    "pass the tab off", "pass the buck", "pass the buck on it", "buck it",
    "buck the tab", "foist it off", "foist the tab off", "fob it off",
    "fob the tab off", "palm it off", "palm the tab off", "palm it off on someone",
    "unload it", "unload the tab", "unload it on someone", "offload it",
    "offload the tab", "offload it onto someone", "dump it on someone", "dump it on someone else",
    "hot potato it", "hot potato", "drop it like a hot potato", "like a hot potato",
    "hot potato the tab", "set it free",
    "set the tab free", "free it", "free the tab", "release it",
    "release the tab", "release it into the wild", "into the wild", "into the wild it goes",
    "back into the wild", "return it to the wild", "let it roam free", "roam free",
    "free range it", "uncage it", "uncage the tab", "unfetter it",
    "unfetter the tab", "unshackle it", "unshackle the tab", "unchain it",
    "unchain the tab", "let it off the leash", "off the leash", "loose it",
    "loose the tab", "let loose the tab", "turn it loose", "turn the tab loose",
    "cut the tab loose", "set it loose", "untie it", "untie the tab",
    "unbind it", "unbind the tab", "free it from bondage", "emancipate it",
    "emancipate the tab", "liberate it", "liberate the tab", "liberate the tab for good",
    "manumit it", "enfranchise it", "unleash it", "unleash the tab",
    "spring it", "spring the tab", "spring it free", "spring it from jail",
    "spring it from the joint", "bust it out", "bust it out of jail", "jailbreak it",
    "jailbreak the tab", "parole it", "parole the tab", "見限れ",
    "見限って", "見放せ", "見放して", "見放すんだ",
    "飽きた", "飽きたぞ", "飽きたので", "飽き飽きだ",
    "飽き飽きした", "うんざりだ", "うんざりした", "うんざりなんだ",
    "うんざりする", "いい加減にしろ", "いい加減にして", "いい加減だ",
    "いい加減にせよ", "用が済んだ", "用済みだ", "用済みだぞ",
    "用済みなんだ", "用済みです", "用済みなので", "役目を終えた",
    "役目は終えた", "役目は終わった", "使命を終えた", "使命は終わった",
    "役割を終えた", "役割は終わった", "お役御免だ", "お役御免",
    "御役御免", "役目終了だ", "任務終了だ", "任務を終えた",
    "任務は終わった", "もう終わりだ", "もう終わった", "もう終わりなんだ",
    "終わりだ", "終わった", "終わったんだ", "終わりなんだ",
    "終わったぞ", "終わったよ", "終わりだよ", "終わりだぞ",
    "終わったの", "終わったわ", "終わりだわ", "終わったんじゃない",
    "終わったんじゃないか", "終わったのでは", "終わったのだ", "終わったのです",
    "終わったのだから", "終わっただろ", "終わっただろう", "終わったでしょう",
    "終わったも同然だ", "終わったも同然", "終わったに等しい", "終わりに等しい",
    "終わりに近い", "終わりに近づいた", "終わりが見えた", "終わりが見える",
    "終わりが近い", "終わりが来た", "終わりの始まり", "終わりを迎えた",
    "終わりを告げた", "終わりを告げる", "終わりを迎える時だ", "終わりの時だ",
    "終わりの時間だ", "終わりの時間が来た", "終わりにしよう", "終わりにしようか",
    "終わりにする", "終わりにするぞ", "終わりにするんだ", "終わりにすべき",
    "終わりにすべきだ", "終わりにしたい", "終わりにしたいんだ", "終わりにしたいのだが",
    "終わりにしたくなった", "終わりにしたくなったので", "終わらせたくなったので", "終わらせる時だ",
    "終わらせる時間だ", "終わらせるものだ", "終わらせるしかなかろう", "終わらせるべきだと考える",
    "終わらせるべきだと判断する", "終わらせるとの判断だ", "終わらせるべきとの見解だ", "終わらせるべきだとの見解だ",
    "終わらせる決定だ", "終わらせる決定をした", "終わらせる決定です", "終わらせることに決めました",
    "終わらせる方向です", "終わらせる意向だ", "終わらせる意向を示した", "終わらせる意向を示したい",
    "終わらせる意志がある", "終わらせる意志だ", "終わらせる旨", "終わらせる旨伝えた",
    "終わらせる件で", "終わらせる件です", "終わらせる件について", "終わらせる件にて",
    "終わらせる予定にした", "終わらせる予定となりました", "終わらせる心積もりだ", "終わらせる算段だ",
    "終わらせる段取りだ", "終わらせる手順だ", "終わらせる運びだ", "終わらせる流れだ",
    "終わらせるという流れだ", "終わらせるという段取りだ", "終わらせるという運びだ", "終わらせるという手順だ",
    "終わらせるという見通しだ", "終わらせるという見込みだ", "終わらせるという算段だ", "終わらせるという心積もりだ",
    "終わらせるという意向だ", "終わらせるという意思だ", "終わらせるという意志だ", "終わらせるという件だ",
    "終わらせるという話だ", "終わらせるという方針だ", "終わらせるという方向だ", "終わらせるという結論だ",
    "終わらせるという判断だ", "終わらせるという決定だ", "終わらせるという所存だ", "終わらせるという見解だ",
    "終わらせるという答えだ", "終わらせるという回答だ", "終わらせるという筋だ", "終わらせるという線だ",
    "終わらせるという形だ", "終わらせるというのが筋だ", "終わらせるというのが見解だ", "終わらせるというのが結論だ",
    "終わらせるというのが判断だ", "終わらせるというのが答えだ", "終わらせると決まった", "終わらせると決まりました",
    "終わらせると決定しました", "終わらせると採決した", "終わらせると採決しました", "終わらせると議決した",
    "終わらせると議決しました", "終わらせると可決した", "終わらせると可決しました", "終わらせると命令された",
    "終わらせると命令した", "終わらせると命じた", "終わらせると命じられた", "終わらせると指示があった",
    "終わらせると指示が出た", "終わらせると指示された", "終わらせるとの指示が出た", "終わらせるとの指示があった",
    "終わらせるという指示だ", "終わらせるという命令だ", "終わらせるという宣告だ", "終わらせるという布告だ",
    "終わらせるという宣言だ", "終わらせるという判決だ", "終わらせるという裁定だ", "終わらせるというお達しだ",
    "終わらせるという沙汰だ", "終わらせるという由だ", "終わらせるという次第だ", "終わらせるという様子だ",
    "終わらせるという風だ", "終わらせるという模様だ",
  ])('routes %s to close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});

describe('pass CCXLIV: negate coverage', () => {
  test.each([
    "ignore the tab", "hands off the tab", "pay it no mind", "pay no mind to it",
    "pay it no heed", "take no notice", "take no notice of it", "turn a blind eye",
    "turn a blind eye to it", "look the other way", "look away from it", "avert my eyes",
    "avert my gaze", "pretend it doesnt exist", "pretend it never existed", "pretend its not there",
    "act like its not there", "act like it doesnt exist", "deny it exists", "deny its existence",
    "deny the tab exists", "refuse to acknowledge it", "refuse to acknowledge the tab", "acknowledge it no more",
    "no longer acknowledge it", "pardon it", "pardon the tab", "exonerate it",
    "exonerate the tab", "exculpate it", "exculpate the tab", "absolve it",
    "absolve the tab", "acquit it", "acquit the tab", "clear its name",
    "clear its record", "vindicate it", "vindicate the tab", "let it off",
    "let the tab off", "let it off the hook", "off the hook", "let it slide",
    "let the tab slide", "let it pass", "let this slide", "forgive it",
    "forgive the tab", "excuse it", "excuse the tab", "overlook it",
    "overlook the tab", "look past it", "give it a pass", "give it a pass this time",
    "give it another chance", "another chance for it", "second chance", "second chance for it",
    "one more chance", "spare it", "spare the tab", "spare its life",
    "spare the tab its life", "show mercy", "show it mercy", "show the tab mercy",
    "have mercy", "have mercy on it", "mercy on it", "mercy on the tab",
    "clemency", "clemency for it", "grant it clemency", "grant clemency",
    "reprieve it", "reprieve the tab", "stay of execution", "stay its execution",
    "stay the execution", "life sentence instead", "leniency", "leniency for it",
    "show leniency", "take it easy on it", "cut it some slack", "cut the tab some slack",
    "give it some slack", "some slack for it", "ease up on it", "ease off it",
    "lighten up on it", "cut it a break", "give it a break", "give it a rest",
    "let it be for now", "let it stand", "let it stand for now", "let it stay",
    "let it stay for now", "let it remain", "suffer it", "suffer the tab",
    "suffer it to live", "tolerate it", "tolerate the tab", "bear with it",
    "bear with the tab", "live with it", "live with the tab", "put up with it",
    "put up with the tab", "abide it", "abide the tab", "endure it",
    "endure the tab", "stand it", "stand the tab", "stomach it",
    "stomach the tab", "weather it", "weather the tab", "ride it out",
    "ride out the tab", "hang onto it", "hang on to it", "hang onto the tab",
    "hold onto it", "hold on to it", "hold onto the tab", "retain it",
    "retain the tab", "keep the tab alive", "keep the tab open", "leave the tab open",
    "let it live", "let the tab live", "let it live for now", "it lives",
    "it lives another day", "let it live another day", "spared for now", "spared it",
    "spared the tab", "spares for it", "reprieved it", "reprieved",
    "it stays", "the tab stays", "it stays open", "it stays put",
    "leave the tab be", "keep the tab", "keep tab of it",
    "let it be so", "as it was", "leave as is", "keep as is",
    "status quo", "status quo for it", "stay the course", "stay it",
    "stay the tab", "stay its demise", "halt its demise", "stop its demise",
    "no demise for it", "unkill it", "unkill the tab",
  ])('routes %s to negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });
});

describe('pass CCXLIV: reopen-tab coverage', () => {
  test.each([
    "resurrect it", "resurrect the tab", "revive it", "revive the tab",
    "resuscitate it", "resuscitate the tab", "bring the tab back", "back to life",
    "reanimate it", "reanimate the tab", "reincarnate it", "reincarnate the tab",
    "restore it", "restore the tab", "reinstate it", "reinstate the tab",
    "undelete it", "undelete the tab", "unerase it", "unbury it",
    "unbury the tab", "dig it up", "dig the tab up", "exhume it",
    "exhume the tab", "unclose it", "unshut it", "unshut the tab",
  ])('routes %s to reopen-tab', (p) => {
    expect(key(mk(), p)).toBe('reopen-tab');
  });
});

describe('pass CCXLIV: close-all-tabs coverage', () => {
  test.each([
    "全部殺せ", "全部消せ",
  ])('routes %s to close-all-tabs', (p) => {
    expect(key(mk(), p)).toBe('close-all-tabs');
  });
});
