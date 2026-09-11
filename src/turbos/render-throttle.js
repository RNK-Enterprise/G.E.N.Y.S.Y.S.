/** Throttle expensive shell updates when document hidden. */

export function renderThrottle() {
  let hidden = false;
  let onVis = null;

  return {
    start() {
      onVis = () => {
        hidden = document.hidden;
        document.documentElement.classList.toggle('axis-render-throttled', hidden);
        window.dispatchEvent(
          new CustomEvent('axis:render-throttle', { detail: { hidden } }),
        );
      };
      document.addEventListener('visibilitychange', onVis);
      onVis();
    },
    stop() {
      if (onVis) document.removeEventListener('visibilitychange', onVis);
      document.documentElement.classList.remove('axis-render-throttled');
    },
  };
}
