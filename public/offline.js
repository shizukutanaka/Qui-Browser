// Offline fallback page logic. Lives in its own file because the CSP allows
// no 'unsafe-inline' scripts — an inline <script> or onclick attribute here
// would be blocked on hosts that send a header CSP.
function checkOnlineStatus() {
  const statusIndicator = document.querySelector('.status-indicator');
  const statusText = document.querySelector('.status-text');

  if (navigator.onLine) {
    statusIndicator.style.background = '#10b981';
    // navigator.onLine only reports OS-level connectivity — it is still
    // true when the site itself is unreachable, so it must never trigger
    // an auto-reload (that would loop forever: reload lands back on this
    // page, onLine is still true, reload…).
    statusText.textContent = 'Network available — tap Try Again to reload.';
    statusIndicator.style.animation = 'none';
  } else {
    statusIndicator.style.background = '#ef4444';
    statusText.textContent = 'Still offline. Some features may be limited.';
  }
}

// Check status every 5 seconds
setInterval(checkOnlineStatus, 5000);

// Initial check
checkOnlineStatus();

// Show offline features
function showOfflineFeatures() {
  const features = document.getElementById('offline-features');
  features.style.display = features.style.display === 'none' ? 'block' : 'none';
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
