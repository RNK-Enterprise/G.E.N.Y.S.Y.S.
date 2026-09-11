/** Coalesce perf/status polling when user is idle. */

export function networkIdle() {
  let idle = false;
  let timer = null;
  const IDLE_MS = 15000;

  function markActive() {
    if (idle) {
      idle = false;
      document.documentElement.classList.remove('axis-network-idle');
      window.dispatchEvent(new CustomEvent('axis:network-idle', { detail: { idle: false } }));
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      idle = true;
      document.documentElement.classList.add('axis-network-idle');
      window.dispatchEvent(new CustomEvent('axis:network-idle', { detail: { idle: true } }));
    }, IDLE_MS);
  }

  const events = ['mousemove', 'keydown', 'pointerdown', 'scroll'];

  return {
    start() {
      events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
      markActive();
    },
    stop() {
      events.forEach((e) => window.removeEventListener(e, markActive));
      clearTimeout(timer);
      document.documentElement.classList.remove('axis-network-idle');
    },
  };
}
