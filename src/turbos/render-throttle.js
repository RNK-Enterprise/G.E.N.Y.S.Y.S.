/** Throttle expensive shell updates when document hidden. */

export function renderThrottle() {
  let hidden = false;
  let onVis = null;

  return {
    start() {
      onVis = () => {
        hidden = document.hidden;
        document.documentElement.classList.toggle('veil-render-throttled', hidden);
        window.dispatchEvent(
          new CustomEvent('veil:render-throttle', { detail: { hidden } }),
        );
      };
      document.addEventListener('visibilitychange', onVis);
      onVis();
    },
    stop() {
      if (onVis) document.removeEventListener('visibilitychange', onVis);
      document.documentElement.classList.remove('veil-render-throttled');
    },
  };
}
