/** Enforce cache/session budget from settings. */

export function cacheBudget() {
  let timer = null;

  function maxMb() {
    const el = document.getElementById('setting-cache-size');
    const n = Number(el?.value || localStorage.getItem('rnk-genysys-cache-mb') || 500);
    return Number.isFinite(n) ? n : 500;
  }

  function prune() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('rnk-genysys-') || k.startsWith('rnk-axis-'))) keys.push(k);
      }
      // Soft budget: if too many genysys keys, drop oldest session-ish blobs
      if (keys.length > 80) {
        const drop = keys.filter((k) => k.includes('session') || k.includes('history-cache')).slice(0, 10);
        drop.forEach((k) => localStorage.removeItem(k));
      }
      localStorage.setItem('rnk-genysys-cache-mb', String(maxMb()));
    } catch { /* quota */ }
  }

  return {
    start() {
      timer = setInterval(prune, 60000);
      prune();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
