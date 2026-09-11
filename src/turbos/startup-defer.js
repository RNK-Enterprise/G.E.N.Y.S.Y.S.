/** Defer non-critical panels until browser is idle. */

export function startupDefer() {
  let cancelled = false;

  function deferWork(fn) {
    if (cancelled) return;
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => !cancelled && fn(), { timeout: 4000 });
    } else {
      setTimeout(() => !cancelled && fn(), 1200);
    }
  }

  return {
    start() {
      cancelled = false;
      deferWork(() => {
        document.documentElement.classList.add('axis-startup-ready');
        window.dispatchEvent(new CustomEvent('axis:startup-idle'));
      });
    },
    stop() {
      cancelled = true;
    },
  };
}
