/**
 * Session-390 direction fixes — voice commands that toggled unconditionally
 * despite the utterance specifying a direction:
 *
 * - bookmark-page is add-only (Chrome Ctrl+D parity): every pattern means
 *   'save this', so an already-bookmarked page must never be un-bookmarked.
 *   Removal stays with the one-direction twin 'unbookmark-page'.
 * - bookmarks panel toggle is direction-aware: 'を閉じて'/'close bookmarks'
 *   while the panel is already closed answers honestly instead of opening it.
 * - Both commands dropped their fixed confirmationText so the spoken line is
 *   always the real post-action state.
 */
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

beforeEach(() => {
  global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
    this.text = text;
  };
});

function makeSpeakingVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = {
    speak: (u) => spoken.push(u.text),
    cancel: () => {},
    speaking: false
  };
  vc.connectBrowser(opts);
  vc._spoken = spoken;
  return vc;
}

describe('VoiceCommands bookmark-page (add-only)', () => {
  const tm = (marked) => ({
    getActiveTab: () => ({
      currentUrl: 'https://x.jp',
      currentTitle: 'X',
      isBookmarked: () => marked
    })
  });

  test.each(['このページを保存して', 'ブックマークに追加', 'bookmark this page'])(
    '"%s" adds via onBookmarkPage',
    (p) => {
      const onBookmarkPage = jest.fn();
      const vc = makeSpeakingVC({ onBookmarkPage, tabManager: tm(false) });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('bookmark-page');
      expect(onBookmarkPage).toHaveBeenCalledTimes(1);
      expect(vc._spoken.at(-1)).toBe('ブックマークを追加しました');
    }
  );

  test.each(['このページを保存して', 'ブックマークに追加', 'bookmark this page'])(
    '"%s" on an already-bookmarked page does NOT un-bookmark it',
    (p) => {
      const onBookmarkPage = jest.fn();
      const vc = makeSpeakingVC({ onBookmarkPage, tabManager: tm(true) });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('bookmark-page');
      expect(onBookmarkPage).not.toHaveBeenCalled();
      expect(vc._spoken.at(-1)).toBe('すでにブックマークされています');
    }
  );

  test('no page open answers honestly instead of claiming a toggle', () => {
    const onBookmarkPage = jest.fn();
    const vc = makeSpeakingVC({
      onBookmarkPage,
      tabManager: { getActiveTab: () => null }
    });
    vc.processCommand('このページを保存して');
    expect(vc.lastCommand.key).toBe('bookmark-page');
    expect(vc._spoken.at(-1)).toBe('ページを開いていません');
  });
});

describe('VoiceCommands bookmarks panel (direction-aware)', () => {
  const panel = (visible) => {
    const bp = { visible, hide: jest.fn() };
    bp.toggle = jest.fn(() => {
      bp.visible = !bp.visible;
    });
    return bp;
  };

  test.each(['ブックマークを閉じて', 'お気に入りを閉じて', 'close the bookmarks'])(
    '"%s" closes a visible panel',
    (p) => {
      const bp = panel(true);
      const vc = makeSpeakingVC({ bookmarkPanel: bp });
      vc.processCommand(p);
      expect(vc.lastCommand.key).toBe('bookmarks');
      expect(bp.toggle).toHaveBeenCalledTimes(1);
      expect(vc._spoken.at(-1)).toBe('ブックマークパネルを閉じます');
    }
  );

  test.each(['ブックマークを閉じて', 'close the bookmarks'])('"%s" on an already-closed panel never opens it', (p) => {
    const bp = panel(false);
    const vc = makeSpeakingVC({ bookmarkPanel: bp });
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('bookmarks');
    expect(bp.toggle).not.toHaveBeenCalled();
    expect(vc._spoken.at(-1)).toBe('ブックマークパネルは開いていません');
  });

  test('bare "ブックマーク" toggles and announces the new state', () => {
    const bp = panel(false);
    bp.toggle = jest.fn(() => {
      bp.visible = !bp.visible;
    });
    const vc = makeSpeakingVC({ bookmarkPanel: bp });
    vc.processCommand('ブックマーク');
    expect(vc.lastCommand.key).toBe('bookmarks');
    expect(bp.toggle).toHaveBeenCalledTimes(1);
    expect(vc._spoken.at(-1)).toBe('ブックマークパネルを開きます');
  });
});
