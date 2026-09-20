/**
 * Browsing subsystem assembly: TabManager (tabs + web panels) and
 * BookmarkPanel, wired with caption/toast/keyboard callbacks.
 *
 * Extracted from VRApp — `app` is the VRApp instance; callbacks read
 * `app.X` lazily at event time so construction order is preserved.
 */

import { TabManager } from './TabManager.js';
import { BookmarkPanel } from './BookmarkPanel.js';
import { hostnameCaption } from './urlDisplay.js';
import { firePanelGrabFeedback } from './WindowManager.js';
import { navigate } from './browserActions.js';
import { getPrefs, largeTextScale } from '../../a11y/accessibility.js';
import { t } from '../../i18n/i18n.js';
import { showCaption } from '../caption.js';
import { hapticBothHands } from '../haptics.js';

export function buildBrowsingSystems(app) {
  if (app.tabManager) {
    return;
  }
  app.tabManager = new TabManager({
    scene: app.scene,
    registerInteractable: (m, h) => app.registerInteractable(m, h),
    unregisterInteractable: (m) => app.unregisterInteractable(m),
    onNavigate: (url, title) => navigate(app, url, title),
    readerProxyUrl: app.settings.readerProxyUrl,
    onLoadError: (url) => app.showVRToast(`Failed to load: ${url}`, { type: 'error' }),
    onBlockedNavigation: () => app.showVRToast(t('vr.error.blockedUrl'), { type: 'warn' }),
    position: { x: 0, y: 1.5, z: -2 },
    // Replace window.prompt() with the VR keyboard.  vrKeyboard is
    // initialised in initializeSystems() before this block runs.
    onUrlInputRequested: (prefill, onConfirm) =>
      app._requestVRKeyboardInput(prefill, (url) => {
        onConfirm(url);
        // Immediate "Loading" caption so caption-reliant users know what URL
        // was submitted before the page loads (WCAG 4.1.3).
        if (url) {
          showCaption(app, `Loading: ${hostnameCaption(url)}`);
        }
      }),
    searchEngine: app.settings.searchEngine,
    // FR-1.4: star button in the chrome bar toggles a persistent bookmark.
    isBookmarked: (url) => app.bookmarks.isBookmarked(url),
    onToggleBookmark: (url, title) => {
      const nowBookmarked = app.bookmarks.toggleBookmark(url, title);
      showCaption(app, nowBookmarked ? t('vr.msg.bookmarked') : t('vr.msg.bookmarkRemoved'));
      return nowBookmarked;
    },
    onTabActivate: (url) => {
      if (app.captionSystem && app.captionSystem.enabled) {
        const label = url ? hostnameCaption(url) : t('vr.msg.newTab');
        app.captionSystem.show(`Tab: ${label}`);
      }
    },
    onTabClose: () => {
      showCaption(app, t('vr.msg.tabClosed'));
    },
    onMaxTabsReached: () => {
      app.showVRToast(t('vr.msg.maxTabsReached'), { type: 'warn' });
    },
    onHoverCaption: () => {
      if (app.settings.enableGazeDwell) {
        showCaption(app, t('vr.msg.tabStripLabel'));
      }
    },
    onPanelHoverCaption: (url, title) => {
      if (app.captionSystem?.enabled && app.settings.enableGazeDwell) {
        // Announce the current page identity (title preferred, hostname as
        // fallback, "Browser controls" when no page is loaded yet) so
        // caption-reliant users know which site they are about to interact
        // with — the visual URL bar is the primary channel but only helps
        // users whose gaze is already on the panel (WCAG 1.3.3).
        const label = (title && title !== url)
          ? title
          : (url ? hostnameCaption(url) : t('vr.msg.browserControls'));
        app.captionSystem.show(label);
      }
    },
    onGrabRequested: (controller) => app._onPanelGrabRequested(controller),
    onMoveBarHoverCaption: () => {
      if (app.settings.enableGazeDwell) {
        showCaption(app, t('vr.msg.moveBarLabel'));
      }
    }
  });
  app.tabManager.addToScene();
  if (app.settings.enableCurvedPanel) {
    app.tabManager.setCurved(true);
  }
  app.tabManager.newTab(); // start with one blank tab
  // Convenience alias: the active tab's panel.
  app.webPanel = app.tabManager.getActiveTab();

  // FR-1.4: in-VR bookmarks & history panel. Selecting an entry navigates
  // the active tab. Toggled via the settings panel "Bookmarks" button.
  app.bookmarkPanel = new BookmarkPanel({
    scene: app.scene,
    registerInteractable: (m, h) => app.registerInteractable(m, h),
    unregisterInteractable: (m) => app.unregisterInteractable(m),
    store: app.bookmarks,
    scale: largeTextScale(getPrefs().largeText),
    onSelect: (url) => {
      const active = app.tabManager ? app.tabManager.getActiveTab() : app.webPanel;
      if (active) {
        active.navigate(url);
      }
      if (url) {
        showCaption(app, `Loading: ${hostnameCaption(url)}`);
      }
    },
    onDeleteBookmark: () => {
      showCaption(app, t('vr.msg.bookmarkDeleted'));
      hapticBothHands(app, 'notification');
    },
    onTabChange: (tab) => {
      showCaption(app, t(tab === 'bookmarks' ? 'vr.bookmarks.tabBookmarks' : 'vr.bookmarks.tabHistory'));
    },
    onHoverCaption: () => {
      if (app.settings.enableGazeDwell) {
        showCaption(app, t('vr.msg.bookmarksPanel'));
      }
    },
    onClose: () => {
      // Mirror the 'Bookmarks: closed' caption that the settings panel
      // 'Bookmarks' button emits, so the state change is announced
      // regardless of which path closed the panel (WCAG 4.1.3).
      showCaption(app, t('vr.msg.bookmarksClosed'));
    }
  });
  app.bookmarkPanel.addToScene();
}

export function _attachManagedWindow(app) {
  if (!app.windowManager) {
    return false;
  }
  const target = app.tabManager
    ? app.tabManager.rootGroup
    : (app.webPanel && app.webPanel.group);
  if (!target) {
    return false;
  }
  if (app.windowManager.target !== target) {
    app.windowManager.attach(target);
  }
  return true;
}

export function _onPanelGrabRequested(app, controller) {
  if (!app.windowManager || !controller) {
    return;
  }
  // Re-checked here rather than assumed: beginGrab() measures from the
  // target's current world position, so a detached or stale target would
  // compute the grab offset from the wrong place. Not gated on success —
  // WindowManager.beginGrab() already no-ops without a target.
  app._attachManagedWindow();
  app.windowManager.beginGrab(controller);
  app._grabController = controller;
  firePanelGrabFeedback(controller, app.hapticFeedback, app.captionSystem);
}

export function _teardownBrowsingSystems(app) {
  if (app.windowManager) {
    app.windowManager.detach();
  }
  if (app.bookmarkPanel) {
    app.bookmarkPanel.dispose();
    app.bookmarkPanel = null;
  }
  if (app.tabManager) {
    app.tabManager.dispose();
    app.tabManager = null;
  } else if (app.webPanel) {
    app.webPanel.dispose();
  }
  app.webPanel = null;
}
