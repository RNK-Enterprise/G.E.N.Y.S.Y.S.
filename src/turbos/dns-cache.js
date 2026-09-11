/** DNS cache via Tauri turbo_dns_lookup when available. */

const cache = new Map();

export function dnsCache() {
  async function lookup(host) {
    if (!host) return null;
    if (cache.has(host)) return cache.get(host);
    try {
      if (window.__TAURI__?.invoke) {
        const result = await window.__TAURI__.invoke('turbo_dns_lookup', { host });
        cache.set(host, result);
        return result;
      }
    } catch {
      cache.set(host, { host, addrs: [], error: true });
    }
    return cache.get(host) || null;
  }

  function onNav(e) {
    try {
      const url = e.detail?.url;
      if (!url) return;
      const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      lookup(host);
    } catch { /* ignore */ }
  }

  return {
    start() {
      window.addEventListener('axis:policy-allow', onNav);
      window.axisDnsCache = { lookup, cache };
    },
    stop() {
      window.removeEventListener('axis:policy-allow', onNav);
      cache.clear();
    },
  };
}
