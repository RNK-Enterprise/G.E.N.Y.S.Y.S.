/** Prefetch hints for likely navigation targets after omnibox idle. */

export function navPrefetch() {
  let timer = null;
  const seen = new Set();

  function prefetch(url) {
    if (!url || seen.has(url) || seen.size > 40) return;
    if (!/^https?:/i.test(url)) return;
    seen.add(url);
    try {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      link.as = 'document';
      document.head.appendChild(link);
    } catch { /* ignore */ }
  }

  function onOmnibox() {
    const input = document.getElementById('url-input') || document.getElementById('omnibox');
    if (!input) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      let v = input.value.trim();
      if (!v) return;
      if (!/^https?:/i.test(v) && v.includes('.')) v = `https://${v}`;
      prefetch(v);
    }, 400);
  }

  return {
    start() {
      const input = document.getElementById('url-input') || document.getElementById('omnibox');
      input?.addEventListener('input', onOmnibox);
      window.addEventListener('axis:policy-allow', (e) => {
        if (e.detail?.url) prefetch(e.detail.url);
      });
    },
    stop() {
      clearTimeout(timer);
      const input = document.getElementById('url-input') || document.getElementById('omnibox');
      input?.removeEventListener('input', onOmnibox);
    },
  };
}
