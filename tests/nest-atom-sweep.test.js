import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

const mk = () => {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [
      { id: 't1', currentTitle: 'A', currentUrl: 'https://a' },
      { id: 't2', currentTitle: 'B', currentUrl: 'https://b' },
      { id: 't3', currentTitle: 'C', currentUrl: 'https://c' },
    ],
    getActiveTab() { return this.tabs.find((t) => t.id === this.activeTabId); },
    closeAllTabs() { return 3; },
    closeTab() {},
    pinTab() {},
    closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
};

const key = (vc, p) => {
  vc.lastCommand = null;
  vc.processCommand(p, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
};

describe('nest atom sweep — pass CCXXV', () => {
  it.each([
    // EN insistence / expectation
    'i expect it closed', 'i expect it shut', 'i demand it be shut',
    'i order it closed', 'i command it closed', 'i insist it closes',
    'i insist it close', 'i insist on it closing',
    'id appreciate it closed', 'id appreciate it shut',
    'id prefer it shut', 'i prefer it closed',
    'we need it shut', 'we expect it closed', 'nobody wants it open',
    // EN modal/verdict declaratives
    'it needs shutting', 'it has to close', 'it must close',
    'it shall close', 'it ought to close', 'it should be shut',
    'it will be closed', 'it will close', 'its closing',
    'its off', 'its away',
    'the tab leaves', 'the tab is going', 'the tab is leaving',
    'the tab must go', 'the tab will close', 'the tab shall close',
    'tab needs to close', 'tab must go', 'tab should close',
    'tab ought to close', 'tab will close',
    'we might close it', 'we may as well close it', 'lets can it',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA 評価名詞IV — urgency
    '閉じるのが緊急', '閉じるが緊急', '閉じるのが急務', '閉じるが急務',
    '閉じるのが要務', '閉じるのが喫緊', '閉じるのが先決',
    '閉じるが先決', '閉じるのが焦眉', '閉じるのが火急',
    // JA 評価名詞IV — certainty/safety
    '閉じるのが必須', '閉じるが必須', '閉じるのが前提',
    '閉じるが前提', '閉じるのが鉄板', '閉じるが鉄板',
    '閉じるのが安全', '閉じるが安全', '閉じるのが確実',
    '閉じるが確実', '閉じるのが無難', '閉じるが無難',
    '閉じるのが手堅い', '閉じるのが定石', '閉じるが定石',
    '閉じるのが賢明', '閉じるが賢明',
    // JA 評価名詞IV — optimality/essence
    '閉じるが最善', '閉じるが最適', '閉じるのが至上',
    '閉じるのが極上', '閉じるのが最高', '閉じるが最高',
    '閉じるのが至極', '閉じるが至極', '閉じるのが真髄',
    '閉じるのが極意', '閉じるのが神髄', '閉じるが神髄',
    '閉じるのが肝要', '閉じるのが要諦', '閉じるのが勘所',
    '閉じるが勘所', '閉じるのが急所', '閉じるが急所',
    '閉じるのが眼目', '閉じるのが要点', '閉じるのが大本',
    '閉じるのが根幹', '閉じるのが基盤', '閉じるのが土台',
    '閉じるのが礎', '閉じるのが基礎', '閉じるのが根本',
    '閉じるのが大黒柱', '閉じるのが肝心', '閉じるが肝心',
    '閉じるのが核心', '閉じるが核心', '閉じるのが要', '閉じるが要',
    '閉じるのが本命', '閉じるが本命', '閉じるのが定番',
    '閉じるが定番', '閉じるのが奥の手', '閉じるのが切り札',
    '閉じるのが秘策', '閉じるのが隠し玉', '閉じるのが虎の子',
    '閉じるのが初手', '閉じるのが先手', '閉じるのが結論',
    '閉じるが結論', '閉じるのが答え', '閉じるが答え',
    '閉じるのが解答', '閉じるのが解',
    // JA temporal nouns + declarative frames
    '閉じたい時期だ', '閉じる時期だ', '閉じる佳境だ',
    '閉じる正念場だ', '閉じる旬だ', '閉じる間際だ',
    '閉じる段階だ', '閉じる局面だ', '閉じる場面だ',
    '閉じる状況だ', '閉じるのでした', '閉じるのでしたから',
    '閉じるからです', '閉じる訳です', '閉じることです',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});
