// Pass CCV — frieze atom sweep: EN modal-shrink/click hedges + shortcut
// queries; JA comparative/optimal + timing + delegation III + negative-
// rhetorical requests + reproach queries.
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [
      { id: 't1', title: 'Alpha', url: 'https://alpha' },
      { id: 't2', title: 'Beta', url: 'https://beta' },
      { id: 't3', title: 'Gamma', url: 'https://gamma' },
    ],
    getActiveTab() { return this.tabs.find(t => t.id === this.activeTabId); },
    closeAllTabs() { return this.tabs.length; },
    closeTab() {}, pinTab() {}, closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('frieze atom sweep (CCV)', () => {
  it.each([
    // EN modal-shrink / click hedges -> close-tab
    'just close it', 'only close it', 'simply close it', 'merely close it',
    'close it only', 'just go close it', 'just shut it',
    'just shut the tab', 'all you do is close it',
    'all you gotta do is close it', 'all you have to do is close it',
    'all it takes is close it', 'all it takes is closing it',
    'just a click close it', 'one click close it', 'one tap close it',
    'a single click close it',
  ])('hedge %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN shortcut/command queries -> help
    'how do i close it again', 'how do i close this again',
    'how do you close it again', 'which button closes it',
    'which key closes it', 'what button closes it',
    'whats the shortcut to close it', 'shortcut to close it',
    'key to close it', 'whats the command for close',
    'what was the close command',
  ])('query %s -> help', (p) => {
    expect(key(mk(), p)).toBe('help');
  });

  it.each([
    // JA comparative / optimal -> close-tab
    '閉じるより他ない', '閉じるよりほかない', '閉じるよりない',
    '閉じる以外ない', '閉じる以外にない', '閉じる他はない',
    '閉じるほかはない', '閉じるよりほかはない', '閉じるしかないじゃん',
    '閉じるのが一番', '閉じるのが最善', '閉じるのが最適',
    '閉じるがベスト', '閉じるがベター', '閉じるが一番',
    '閉じるのがベスト',
  ])('JA optimal %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA timing / opportunity -> close-tab
    '閉じるとしたら今', '閉じるなら今', '閉じるなら今だ',
    '閉じるならここ', '閉じるタイミング', '閉じるタイミングだ',
    '閉じるタイミングかな', '閉じ時かな', '閉じ時だ', '閉じ時では',
    '閉じどき', '閉じどきかな', '閉じる頃合い', '閉じる頃合いだ',
    '閉じるいい機会', '閉じる機会だ',
  ])('JA timing %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA delegation III -> close-tab
    '閉じるの任せる', '閉じるの任せた', '閉じるのお任せします',
    '閉じるのおまかせ', '閉じるのおまかせします', '閉じるのよろしくね',
    '閉じることお願いする', '閉じることお願いします',
    '閉じることをお願い', '閉じることをお願いする',
    '閉じることをお願いします',
  ])('JA delegation %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA negative-rhetorical requests -> close-tab
    '閉じてはくれないのか', '閉じてもくれないのか',
    '閉じてくれないのかな',
  ])('JA neg-rhetorical %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA reproach/refusal queries -> trouble
    '閉じないのかしら', '閉じれないのかしら', '閉じられないのかしら',
    '閉じないわけですか', '閉じないわけか', '閉じないのかなって',
  ])('JA reproach %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });
});
