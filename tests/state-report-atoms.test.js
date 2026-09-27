/**
 * State-report & refusal atoms — JA kept/resultative tails (ておきます),
 * quotative imperatives (ろと言った), aspect reports (かける/つつある/終わった),
 * inability reports → trouble, no-need-to forms → negate, hedge openers II
 * (だって/マジで/つーか), exits II (失礼します/お先に), praise/reaction fills
 * + EN inability→trouble, no-need/forget-about→negate, exit/praise fills
 * (pass LVI).
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeTabs(titles) {
  const calls = { closeTab: [], setActive: [], closeTabs: [] };
  const tm = {
    tabs: titles.map((t) => ({ title: t })),
    activeIndex: 0,
    getActiveTab() { return this.tabs[this.activeIndex]; },
    closeTab(i) { calls.closeTab.push(i); },
    setActive(i) { this.activeIndex = i; calls.setActive.push(i); },
    closeTabs(idxs) { calls.closeTabs.push(idxs); },
  };
  return { tm, calls };
}

function boot(titles) {
  const vc = new VoiceCommands({ enabled: true });
  const { tm, calls } = makeTabs(titles);
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  return { vc, tm, calls };
}

function run(vc, p) {
  vc.lastCommand = null;
  vc.processCommand(p);
  return vc.lastCommand;
}

describe('JA resultative/quotative/honorific tails execute', () => {
  const { vc } = boot(['A', 'B', 'C']);
  const cases = [
    ['閉じておきます', 'close-tab'], ['閉じなさいますか', 'close-tab'],
    ['閉じていただきたく', 'close-tab'],
    ['閉じさせていただければ', 'close-tab'],
    ['閉じろと言った', 'close-tab'], ['閉じてって言った', 'close-tab'],
    ['閉じてはよ', 'close-tab'], ['早よ閉じて', 'close-tab'],
    ['閉じてったら', 'close-tab'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA aspect/state reports → describe-tab', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['閉じかける', 'describe-tab'], ['閉じつつある', 'describe-tab'],
    ['閉じ終わった', 'describe-tab'], ['閉じ終えた', 'describe-tab'],
    ['閉じちゃいそう', 'describe-tab'], ['閉じられそう', 'describe-tab'],
    ['開きっぱ', 'describe-tab'], ['閉じっぱ', 'describe-tab'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA inability reports → trouble', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['閉じられない', 'trouble'], ['閉じれない', 'trouble'],
    ['閉じられないんだけど', 'trouble'], ['読めない', 'trouble'],
    ['読めません', 'trouble'], ['動かせない', 'trouble'],
    ['消せない', 'trouble'], ['進められない', 'trouble'],
    ['なんとかならない', 'help'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA refusal/prohibition forms → negate', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['閉じなくてもいい', 'negate'], ['閉じなくても', 'negate'],
    ['戻らなくても', 'negate'], ['読まなくてもいい', 'negate'],
    ['閉じちゃダメ', 'negate'], ['閉じちゃだめだよ', 'negate'],
    ['閉じるのやめて', 'negate'], ['閉じるのはやめて', 'negate'],
    ['だめです', 'negate'], ['ダメ', 'negate'],
    ['冗談で閉じて', 'negate'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('JA hedge openers II + exits II + reactions II', () => {
  const { vc } = boot(['A', 'B', 'C']);
  const cases = [
    ['だって閉じて', 'close-tab'], ['ほんとに閉じて', 'close-tab'],
    ['本当に閉じて', 'close-tab'], ['マジで閉じて', 'close-tab'],
    ['ガチで閉じて', 'close-tab'], ['つーか閉じて', 'close-tab'],
    ['っつーか閉じて', 'close-tab'],
    ['ごきげんよう', 'vr-exit'], ['失礼します', 'vr-exit'],
    ['お先に', 'vr-exit'], ['お先に失礼します', 'vr-exit'],
    ['帰る', 'vr-exit'], ['帰ります', 'vr-exit'], ['もう終わり', 'vr-exit'],
    ['嘘', 'ack'], ['うそつき', 'ack'], ['まじでか', 'ack'],
    ['信じられない', 'ack'], ['それな', 'ack'], ['せやな', 'ack'],
    ['わかる', 'ack'], ['わかるわ', 'ack'], ['ナイス', 'ack'],
    ['グッド', 'ack'], ['ブラボー', 'ack'], ['お見事', 'ack'],
    ['ごめんなさい', 'ack'], ['がんばって', 'ack'], ['頑張って', 'ack'],
    ['まかせた', 'ack'], ['まかせる', 'ack'], ['おまかせ', 'ack'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('EN inability & fault reports → trouble', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['cant close it', 'trouble'], ['wont close', 'trouble'],
    ['it wont close', 'trouble'], ['wont let me close it', 'trouble'],
    ['i cant go back', 'trouble'], ['cant read it', 'trouble'],
    ['wont load', 'trouble'], ['not loading', 'trouble'],
    ['fix it', 'trouble'], ['repair it', 'trouble'], ['its broken', 'trouble'],
    ['it broke', 'trouble'], ['glitchy', 'trouble'], ['buggy', 'trouble'],
    ['janky', 'trouble'], ['laggy', 'trouble'], ['choppy', 'trouble'],
    ['stuttery', 'trouble'], ['freezing up', 'trouble'], ['hanging', 'trouble'],
    ['hung', 'trouble'], ['stuck again', 'trouble'],
    ['wont respond', 'trouble'], ['unresponsive', 'trouble'],
    ['something went wrong', 'trouble'], ['same thing', 'trouble'],
    ['why is it slow', 'trouble'], ['why wont it work', 'trouble'],
    ['not again', 'trouble'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('EN no-need / forget forms → negate', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['no need to close it', 'negate'], ['no need for that', 'negate'],
    ['forget about closing it', 'negate'], ['forget about it', 'negate'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('EN exits & praise fills', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['close session', 'vr-exit'], ['end session', 'vr-exit'],
    ['im done here', 'vr-exit'],
    ['turn it all off', 'stop-everything'], ['kill everything', 'stop-everything'],
    ['hit the hay', 'sleep-mode'],
    ['kudos', 'ack'], ['props', 'ack'], ['hat tip', 'ack'],
    ['nailed it', 'ack'], ['crushed it', 'ack'], ['well played', 'ack'],
    ['nice work', 'ack'], ['good stuff', 'ack'], ['on point', 'ack'],
    ['spot on', 'ack'], ['bang on', 'ack'], ['dead on', 'ack'],
    ['bullseye', 'ack'], ['you rock', 'ack'], ['you rule', 'ack'],
    ['youre the best', 'ack'], ['lifesaver', 'ack'], ['beautiful', 'ack'],
    ['gorgeous', 'ack'], ['stunning', 'ack'], ['slick', 'ack'],
    ['clean', 'ack'], ['sharp', 'ack'], ['lets gooo', 'ack'], ['gg', 'ack'],
    ['oh no', 'ack'], ['here we go again', 'ack'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});

describe('coexistence — established routes preserved', () => {
  const { vc } = boot(['A', 'B', 'C']);
  const cases = [
    ['戻れない', 'back-status'], ['進めない', 'forward-status'],
    ['閉じなくていい', 'negate'], ['閉じないでください', 'negate'],
    ['そのまま', 'negate'], ['このまま', 'negate'],
    ['dont bother closing it', 'negate'], ['leave it open', 'negate'],
    ['not responding', 'trouble'], ['not responding to me', 'trouble'],
    ['閉じて', 'close-tab'], ['mind if i close it', 'help'],
    ['よろしくね', 'help'], ['寝る', 'sleep-mode'],
    ['またね', 'vr-exit'], ['閉じちゃった', 'reopen-tab'],
    ['開いたばかりのページ', 'history-latest'],
    ['save it for later', 'bookmark-page'],
  ];
  it.each(cases)('"%s" → %s', (p, key) => {
    expect(run(vc, p)?.key).toBe(key);
  });
});
