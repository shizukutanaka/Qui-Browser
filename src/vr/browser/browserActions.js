/**
 * Browser feature actions: URL prompts via the VR keyboard, history recording,
 * immersive video launch and destructive history clearing. Extracted from
 * VRApp — `app` supplies settings/subsystems/caption+toast channels.
 */
import { t } from '../../i18n/i18n.js';
import { normalizeProxyUrl, hostnameCaption } from './urlDisplay.js';
import { detectVideoFormat } from '../media/videoProjection.js';

/**
 * Ask for the reader-proxy base URL on the VR keyboard and apply it live.
 * Empty input clears the proxy (back to direct fetch); valid input is
 * persisted and pushed to every open tab immediately.
 */
export function requestReaderProxyInput(app) {
  const prefill = app.settings.readerProxyUrl || 'http://';
  app._requestVRKeyboardInput(prefill, (typed) => {
    const out = normalizeProxyUrl(typed);
    if (!out.ok) {
      app.showVRToast(t('vr.error.proxyInvalid'), { type: 'warn' });
      return;
    }
    app.updateSetting('readerProxyUrl', out.value);
    if (app.tabManager) {
      app.tabManager.setReaderProxyUrl(out.value);
    } else if (app.webPanel && app.webPanel.setReaderProxyUrl) {
      app.webPanel.setReaderProxyUrl(out.value);
    }
    app.showVRToast(
      t(out.value ? 'vr.msg.proxySet' : 'vr.msg.proxyCleared'),
      { type: 'info' }
    );
  }, t('vr.prompt.proxyUrl'));
}

/**
 * Clear all persisted browsing history (privacy) with a cross-modal
 * confirmation, refreshing the bookmark/history panel if open.
 */
export function clearBrowsingHistory(app) {
  app.bookmarks.clearHistory();
  if (app.bookmarkPanel && app.bookmarkPanel.visible) {
    app.bookmarkPanel._draw();
  }
  app.showVRToast(t('vr.msg.historyCleared'), { type: 'info' });
}

/**
 * Prompt for a video URL and play it as an immersive 360°/180° video.
 * Projection and stereo layout are auto-detected from the URL.
 */
export function launchImmersiveVideo(app) {
  app._requestVRKeyboardInput('https://', (url) => {
    if (!url || !app.immersiveVideo) {
      return;
    }
    app.immersiveVideo.play(url, detectVideoFormat(url));
  }, 'Enter video URL');
}

/**
 * Record a page visit in history and caption the title so caption-enabled
 * users know which page loaded.
 */
export function navigate(app, url, title = url) {
  app.bookmarks.addHistory(url, title);
  if (app.captionSystem && app.captionSystem.enabled) {
    const label = (title !== url) ? title : hostnameCaption(url);
    app.captionSystem.show(label);
  }
}
