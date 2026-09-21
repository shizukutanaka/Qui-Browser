// Offline fallback page logic. Lives in its own file because the CSP allows
// no 'unsafe-inline' scripts — an inline <script> or onclick attribute here
// would be blocked on hosts that send a header CSP.

// The page must work when the network is down, so it cannot load the app's
// i18n module graph — the Japanese strings are kept inline here instead,
// selected by the same storage key the app writes ('qui-browser:lang').
const STR = {
  en: {
    description: "You're currently offline. Pages you've visited may still load from cache, and your data stays on this device.",
    reconnecting: 'Attempting to reconnect...',
    online: 'Network available — tap Try Again to reload.',
    stillOffline: 'Still offline. Some features may be limited.',
    retry: 'Try Again',
    featuresBtn: 'View Offline Features',
    featuresTitle: 'Available Offline',
    features: [
      'Pages you visited before may still load from cache',
      'Your bookmarks, history and settings stay on this device',
      "This page reloads itself the moment you're back online"
    ]
  },
  ja: {
    description: '現在オフラインです。閲覧済みのページはキャッシュから開けることがあります。データはこの端末に保存されています。',
    reconnecting: '再接続を試みています…',
    online: 'ネットワーク復帰 — 「再試行」で再読み込みします。',
    stillOffline: 'まだオフラインです。一部の機能は制限されます。',
    retry: '再試行',
    featuresBtn: 'オフラインで使える機能',
    featuresTitle: 'オフラインで可能なこと',
    features: [
      '閲覧済みのページはキャッシュから開けることがあります',
      'ブックマーク・履歴・設定はこの端末に保存されています',
      'オンラインに戻った時点でこのページは自動で再読み込みされます'
    ]
  }
};

let STRINGS = STR.en;

function applyLanguage() {
  let lang = 'en';
  try {
    lang = localStorage.getItem('qui-browser:lang') || 'en';
  } catch {
    // storage can throw under privacy modes — default to en
  }
  if (lang !== 'ja') {
    return;
  }
  STRINGS = STR.ja;
  // WCAG 3.1.1 — the page language must match its content so screen readers
  // pick a Japanese voice, not an English one reading romaji gibberish.
  document.documentElement.lang = 'ja';
  document.getElementById('offline-description').textContent = STRINGS.description;
  document.getElementById('status-text').textContent = STRINGS.reconnecting;
  document.getElementById('btn-retry').textContent = STRINGS.retry;
  document.getElementById('btn-features').textContent = STRINGS.featuresBtn;
  document.querySelector('.features-title').textContent = STRINGS.featuresTitle;
  const list = document.getElementById('features-list');
  list.innerHTML = '';
  for (const item of STRINGS.features) {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  }
}

function checkOnlineStatus() {
  const statusIndicator = document.querySelector('.status-indicator');
  const statusText = document.getElementById('status-text');

  if (navigator.onLine) {
    statusIndicator.style.background = '#10b981';
    // navigator.onLine only reports OS-level connectivity — it is still
    // true when the site itself is unreachable, so it must never trigger
    // an auto-reload (that would loop forever: reload lands back on this
    // page, onLine is still true, reload…).
    statusText.textContent = STRINGS.online;
    statusIndicator.style.animation = 'none';
  } else {
    statusIndicator.style.background = '#ef4444';
    statusText.textContent = STRINGS.stillOffline;
  }
}

// Check status every 5 seconds
setInterval(checkOnlineStatus, 5000);

applyLanguage();
// Initial check
checkOnlineStatus();

// Show offline features
function showOfflineFeatures() {
  const features = document.getElementById('offline-features');
  const btn = document.getElementById('btn-features');
  const open = features.style.display === 'none';
  features.style.display = open ? 'block' : 'none';
  btn.setAttribute('aria-expanded', String(open));
}

document.getElementById('btn-retry')
  .addEventListener('click', () => window.location.reload());
document.getElementById('btn-features')
  .addEventListener('click', showOfflineFeatures);

// Only a genuine offline→online transition may auto-reload: it is the one
// signal that connectivity actually changed.
window.addEventListener('online', () => {
  window.location.reload();
});
window.addEventListener('offline', checkOnlineStatus);
