/** Periodic memory reclaim for suspended tabs. */

export function memoryReclaim() {
  let timer = null;

  function reclaim() {
    const tabs = window.tabManager?.tabs || [];
    for (const tab of tabs) {
      if (!tab.suspended || !tab.iframe) continue;
      try {
        // Drop any retained srcdoc blob
        tab._suspendedSrcdoc = null;
        if (tab.iframe.contentWindow) {
          /* cannot freely touch cross-origin */
        }
      } catch { /* ignore */ }
    }
    if (window.gc) {
      try {
        window.gc();
      } catch { /* ignore */ }
    }
    window.dispatchEvent(new CustomEvent('axis:memory-reclaim'));
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(reclaim, 30000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
