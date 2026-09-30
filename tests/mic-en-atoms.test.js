/**
 * Mic-state & EN-parity atoms (round 66).
 *
 * Probe-driven: 'unmute mic' hit stop's loose /mute mic/ (the 'mute' inside
 * 'unmute') and switched the mic OFF; bare 'unpin' fell through to pin-tab's
 * toggle; 'close the tab' was owned by close-tab-by-name searching for a
 * literal 'the' tab; 'go to the top'/'go to bottom' literal-navigated via
 * go-to; and a batch of bare EN forms ('pause', 'resume', 'volume',
 * 'louder', 'scroll left', 'minimize', 'sleep', 'exit') were NO-MATCH.
 */

let VoiceCommands;
try { VoiceCommands = require('../src/vr/input/VoiceCommands').VoiceCommands; }
catch { VoiceCommands = null; }

function makeVC() {
  const spoken = [];
  const tm = {
    tabs: [
      { id: 'a', currentUrl: 'https://news.jp', currentTitle: 'ニュース', pinned: true, goBack: jest.fn(() => true), goForward: jest.fn(() => true) },
      { id: 'b', currentUrl: 'https://weather.jp', currentTitle: '天気', pinned: false },
    ],
    activeIndex: 0,
    setActive: jest.fn(function (i) { this.activeIndex = i; }),
    getActiveTab: jest.fn(function () { return this.tabs[this.activeIndex]; }),
    togglePin: jest.fn(function (i) {
      this.tabs[i].pinned = !this.tabs[i].pinned;
      return this.tabs[i].pinned ? 'pinned' : 'unpinned';
    }),
    newTab: jest.fn(() => ({ id: 'new' })),
    closeTab: jest.fn(function (i) { return !this.tabs[i].pinned; }),
  };
  const vc = new VoiceCommands({ enabled: true });
  vc.onGoTo = jest.fn();
  vc._onVolume = jest.fn();
  vc._onVolumeStatus = jest.fn(() => 30);
  vc.connectBrowser({ tabManager: tm, onGoTo: vc.onGoTo });
  vc.speak = jest.fn((s) => spoken.push(s));
  vc._spoken = spoken;
  vc._tm = tm;
  return vc;
}
const run = (vc, phrase) => vc.processCommand(phrase);
const key = (vc) => vc.lastCommand?.key;
const last = (vc) => vc._spoken[vc._spoken.length - 1] || '';

describe('mic-on vs mic-off', () => {
  test.each(['unmute mic', 'mic on', 'start listening', 'turn on the mic'])(
    '"%s" resumes listening instead of stopping it', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('mic-on');
      expect(last(vc)).toContain('再開');
    });
  test.each(['mute the mic', 'mic off', 'stop listening'])(
    '"%s" still stops listening', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('stop');
    });
});

describe('unpin direction safety', () => {
  test.each(['unpin', 'unpin this', 'unpin it', 'unpin the tab', 'unpin tab'])(
    '"%s" unpins the active tab (never re-pins)', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('unpin-active');
      expect(vc._tm.togglePin).toHaveBeenCalledWith(0);
      expect(vc._tm.tabs[0].pinned).toBe(false);
    });
  test('"unpin all" targets every pinned tab, not just the active one', () => {
    const vc = makeVC();
    run(vc, 'unpin all');
    expect(key(vc)).toBe('unpin-all');
  });
  test('"unpin tab 2" addresses the strip position, not the active tab', () => {
    const vc = makeVC();
    run(vc, 'unpin tab 2');
    expect(key(vc)).toBe('tab-pin-n');
    expect(vc._tm.togglePin).toHaveBeenCalledWith(1);
  });
  test('"pin this tab" toggles the active pin', () => {
    const vc = makeVC();
    run(vc, 'pin this tab');
    expect(key(vc)).toBe('pin-tab');
    expect(vc._tm.togglePin).toHaveBeenCalledWith(0);
  });
});

describe('close-the-tab routing', () => {
  test.each(['close the tab', 'close this one', 'close it'])(
    '"%s" closes the active tab, not a search for "the"', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('close-tab');
    });
  test('"close the weather tab" still closes by name', () => {
    const vc = makeVC();
    run(vc, 'close the weather tab');
    expect(key(vc)).toBe('close-tab-by-name');
    expect(vc._tm.closeTab).toHaveBeenCalledWith(1);
  });
});

describe('EN go-to page edges', () => {
  test.each(['go to the top', 'go to top'])('"%s" scrolls to top', (p) => {
    const vc = makeVC();
    const tab = vc._tm.getActiveTab();
    tab.scrollToTop = jest.fn(() => true);
    run(vc, p);
    expect(key(vc)).toBe('scroll-top');
    expect(tab.scrollToTop).toHaveBeenCalled();
    expect(vc.onGoTo).not.toHaveBeenCalled();
  });
  test.each(['go to bottom', 'go to the bottom'])('"%s" scrolls to bottom', (p) => {
    const vc = makeVC();
    const tab = vc._tm.getActiveTab();
    tab.scrollToBottom = jest.fn(() => true);
    run(vc, p);
    expect(key(vc)).toBe('scroll-bottom');
    expect(vc.onGoTo).not.toHaveBeenCalled();
  });
  test.each(['go home', 'go to the home', 'go to home page'])('"%s" opens home', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('home');
    expect(vc.onGoTo).not.toHaveBeenCalled();
  });
  test('"go to google" still navigates', () => {
    const vc = makeVC();
    run(vc, 'go to google');
    expect(key(vc)).toBe('go-to');
    expect(vc.onGoTo).toHaveBeenCalled();
  });
});

describe('scroll/read bare forms', () => {
  test('"go up"/"go down" scroll vertically', () => {
    const vc = makeVC();
    expect(key(vc) === undefined || true).toBe(true);
    run(vc, 'go up');
    expect(key(vc)).toBe('scroll-up');
    run(vc, 'go down');
    expect(key(vc)).toBe('scroll-down');
  });
  test.each(['scroll left', 'scroll right', '左にスクロール', '横にスクロール'])(
    '"%s" explains panels scroll vertically', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('scroll-horizontal');
      expect(last(vc)).toContain('左右のスクロール');
    });
  test.each(['start reading', 'read page', 'read it'])(
    '"%s" reads the page aloud', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('read-aloud');
    });
  test.each(['pause', 'pause it'])('"%s" pauses narration', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('pause-reading');
  });
  test.each(['resume', 'continue', 'continue reading'])(
    '"%s" resumes narration', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('resume-reading');
    });
});

describe('EN status/alias forms', () => {
  test.each(['what page is this', 'which page is this', 'what site is this'])(
    '"%s" answers where-am-i', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('where-am-i');
      expect(last(vc)).toContain('ニュース');
    });
  test.each(['list all tabs', 'show all tabs', 'all tabs', 'my tabs'])(
    '"%s" reads the tab list', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('tabs-list');
      expect(last(vc)).toContain('ニュース');
    });
  test.each(['volume', 'how loud', 'what volume'])('"%s" reports volume', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('volume-status');
    expect(last(vc)).toContain('30');
  });
  test.each(['louder', 'speak up', 'turn it up'])('"%s" raises volume', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('volume-up');
    expect(vc._onVolume).toHaveBeenCalledWith(0.1);
  });
  test.each(['quieter', 'turn it down', 'speak softer'])('"%s" lowers volume', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('volume-down');
    expect(vc._onVolume).toHaveBeenCalledWith(-0.1);
  });
});

describe('honest shell states', () => {
  test.each(['minimize', 'maximize', 'minimize the window', '最小化', '最大化'])(
    '"%s" explains no minimize/maximize exists', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('window-state');
      expect(last(vc)).toContain('最小化');
    });
  test.each(['sleep', 'wake up', 'lock', 'standby'])(
    '"%s" points at the headset hardware', (p) => {
      const vc = makeVC();
      run(vc, p);
      expect(key(vc)).toBe('sleep-mode');
      expect(last(vc)).toContain('本体');
    });
  test.each(['exit', 'shut down'])('"%s" exits VR mode', (p) => {
    const vc = makeVC();
    run(vc, p);
    expect(key(vc)).toBe('vr-exit');
  });
});

describe('coexistence guards', () => {
  test('"ニュースのタブ" still switches by name', () => {
    const vc = makeVC();
    run(vc, 'ニュースのタブ');
    expect(key(vc)).toBe('tab-by-name');
  });
  test('"exit fullscreen" still exits fullscreen', () => {
    const vc = makeVC();
    run(vc, 'exit fullscreen');
    expect(key(vc)).toBe('vr-exit');
  });
  test('"zoom in" still enlarges reader text', () => {
    const vc = makeVC();
    run(vc, 'zoom in');
    expect(key(vc)).toBe('reader-size-up');
  });
  test('bare "zoom"/"ズーム" report the current scale', () => {
    const vc = makeVC();
    run(vc, 'zoom');
    expect(key(vc)).toBe('reader-scale-status');
    run(vc, 'ズーム');
    expect(key(vc)).toBe('reader-scale-status');
  });
});
