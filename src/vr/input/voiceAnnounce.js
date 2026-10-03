/**
 * Announce-string producers for the voice-command handlers that live outside
 * VoiceCommands.js — clipboard and share actions wired from
 * VRApp.initializeSystems(). Extracted so the strings are reachable without
 * running the full subsystem-init method (and so they can route through t()).
 */

import { t } from '../../i18n/i18n.js';

// Chrome "Paste and go" — navigate the active tab to a URL in the clipboard.
// Async: resolves to the announce string (spoken + captioned).
export async function pasteAndGo(tabManager) {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (/^https?:\/\//i.test(text)) {
      tabManager?.getActiveTab?.()?.navigate?.(text);
      return t('vr.voice.pasteGoOpened');
    }
    return t('vr.voice.noUrlCopied');
  } catch {
    return t('vr.voice.clipboardDenied');
  }
}

// NVDA read-clipboard — speak the clipboard text aloud.
export async function readClipboard() {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    return text || t('vr.voice.clipboardEmpty');
  } catch {
    return t('vr.voice.clipboardDenied');
  }
}

// Web Share API — the OS share sheet; clipboard is the fallback where the API
// is missing (and it still announces that honestly).
export async function sharePage(tabManager) {
  const tab = tabManager?.getActiveTab?.();
  const url = tab?.currentUrl;
  if (!url) {
    return t('vr.voice.shareNoUrl');
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: tab.currentTitle || url, url });
      return t('vr.voice.shareDone');
    } catch {
      return t('vr.voice.shareCancelled');
    }
  }
  try {
    await navigator.clipboard?.writeText?.(url);
    return t('vr.voice.shareCopied');
  } catch {
    return t('vr.voice.shareFailed');
  }
}
