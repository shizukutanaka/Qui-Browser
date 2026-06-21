/**
 * Pure, dependency-free debounce.
 *
 * Returns a function that, when invoked repeatedly, only runs the wrapped
 * callback after `wait` ms have elapsed since the most recent call. The
 * canonical use case is `window.resize`: the browser can fire dozens of
 * events per drag-resize, and re-laying out the renderer / camera on every
 * one is wasteful and visually noisy (per the JP dev community resize-event
 * best-practice posts).
 *
 * The returned function exposes `.cancel()` so callers can drop a pending
 * trailing-edge invocation during teardown — important for SPA-style
 * lifecycles where the host (e.g. VRApp) may dispose while a resize timer
 * is still armed.
 *
 * @param {Function} fn    callback to invoke after the quiet window
 * @param {number}   wait  quiet-window length in ms (default 150)
 * @returns {Function & { cancel(): void }}
 */
export function debounce(fn, wait = 150) {
  let timerId = null;
  const debounced = function (...args) {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      timerId = null;
      fn.apply(this, args);
    }, wait);
  };
  debounced.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
  return debounced;
}
