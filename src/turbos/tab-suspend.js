/**
 * Suspend inactive iframe tabs (detach src, keep URL).
 * Not Chrome process isolation — best-effort for iframe shell.
 */

export function tabSuspend(ctx = {}) {
  let onDeactivate = null;
  let onActivate = null;

  function suspendTab(tab) {
    if (!tab?.iframe || tab.suspended) return;
    const url = tab.url || tab.iframe.src;
    if (!url || url.startsWith('axis://') || url === 'about:blank') return;
    tab._suspendedUrl = url;
    tab._suspendedSrcdoc = tab.iframe.srcdoc || null;
    try {
      tab.iframe.removeAttribute('srcdoc');
      tab.iframe.src = 'about:blank';
    } catch { /* ignore */ }
    tab.suspended = true;
  }

  function resumeTab(tab) {
    if (!tab?.iframe || !tab.suspended) return;
    const url = tab._suspendedUrl;
    try {
      if (tab._suspendedSrcdoc) {
        tab.iframe.srcdoc = tab._suspendedSrcdoc;
      } else if (url) {
        tab.iframe.src = url;
      }
    } catch { /* ignore */ }
    tab.suspended = false;
  }

  return {
    start() {
      onDeactivate = (e) => {
        const { tab, activeId } = e.detail || {};
        const tabs = ctx.getTabs?.() || window.tabManager?.tabs || [];
        for (const t of tabs) {
          if (t.id !== activeId) suspendTab(t);
        }
        if (tab && tab.id === activeId) resumeTab(tab);
      };
      onActivate = (e) => {
        const tab = e.detail?.tab;
        if (tab) resumeTab(tab);
      };
      window.addEventListener('axis:tab-deactivated', onDeactivate);
      window.addEventListener('axis:tab-activated', onActivate);
    },
    stop() {
      if (onDeactivate) window.removeEventListener('axis:tab-deactivated', onDeactivate);
      if (onActivate) window.removeEventListener('axis:tab-activated', onActivate);
      const tabs = ctx.getTabs?.() || window.tabManager?.tabs || [];
      for (const t of tabs) resumeTab(t);
    },
    suspendTab,
    resumeTab,
  };
}
