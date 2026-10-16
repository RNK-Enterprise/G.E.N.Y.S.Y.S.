/**
 * GENYSYS™ — Spotlight (header dropdown)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Contextual actions for the active tab, surfaced from a ⚡ button in the
 * titlebar. Replaces the old sidebar Spotlight section.
 */

window.getGENYSYSSpotlightSuggestions = function getGENYSYSSpotlightSuggestions() {
  const activeTab = window.getActiveBrowserTab?.();
  const recentHistory = window.genysysSpotlightCaps('genysys-history')
    ? (window.historyManager?.getRecent?.(8) || window.historyManager?.recent || [])
    : [];
  const downloadSummary = window.genysysSpotlightCaps('genysys-downloads')
    ? (window.getGENYSYSDownloadSummary?.() || { downloads: [] })
    : { downloads: [], active: [], paused: [], completed: [], failed: [] };

  if (!activeTab) {
    const suggestions = [{
      title: 'Open a new tab',
      meta: 'No active page is selected.',
      badge: 'Shell',
      action: () => window.tabManager.createTab(),
    }];
    if (recentHistory.length > 0) {
      const recentItem = recentHistory[0];
      suggestions.unshift({
        title: 'Resume latest page',
        meta: `${recentItem.title || recentItem.url}`,
        badge: 'History',
        action: () => window.tabManager.createTab(recentItem.url),
      });
    }
    return suggestions.slice(0, 4);
  }

  const host = window.getTabHost?.(activeTab) || '';
  const title = activeTab.title || 'Untitled page';
  const url = activeTab.url || '';
  const context = window.getGENYSYSSpotlightContext?.(host, title, url) || 'general';
  const suggestions = [];
  const isBookmarked = url ? window.bookmarkManager?.isBookmarked?.(url) : false;
  const push = (cond, item) => window.genysysSpotlightPush(suggestions, cond, item);
  const cap = window.genysysSpotlightCaps;

  push(true, { title: 'Focus omnibox', meta: url || 'Type a destination', badge: 'Nav', action: () => window.focusOmniboxOnly?.() });
  push(true, { title: 'New tab', meta: 'Open another browsing surface', badge: 'Shell', action: () => window.tabManager.createTab() });
  push(!!url && cap('genysys-bookmarks'), {
    title: isBookmarked ? 'Remove bookmark' : 'Bookmark this page',
    meta: host || url,
    badge: 'Bookmarks',
    action: () => (isBookmarked ? window.bookmarkManager?.removeBookmark?.((window.bookmarkManager?.getBookmark?.(url) || {}).id) : window.bookmarkManager?.addBookmark?.(title, url)),
  });
  push(cap('genysys-history'), { title: 'Recently closed', meta: 'Restore closed tabs', badge: 'History', action: () => window.showRecentlyClosedModal?.() });
  push(cap('genysys-downloads'), { title: 'Open downloads', meta: `${(downloadSummary.downloads || []).length} items`, badge: 'Downloads', action: () => window.openGENYSYSDownloadsSection?.() });
  push(cap('genysys-performance-stack'), { title: 'Performance panel', meta: 'Live turbos and metrics', badge: 'Perf', action: () => window.togglePerformancePanel?.() });
  push(true, { title: 'Settings', meta: 'Preferences and density', badge: 'Settings', action: () => window.openSettings?.() });
  push(context === 'workspace' && cap('genysys-history'), { title: 'Related history', meta: 'Pages on this trail', badge: 'History', action: () => window.showRecentlyClosedModal?.() });
  push(!!url && !!navigator.clipboard?.writeText, {
    title: 'Copy page URL',
    meta: url,
    badge: 'Link',
    action: async () => {
      try { await navigator.clipboard.writeText(url); window.updateStatusBar?.('Link copied'); }
      catch { window.updateStatusBar?.('Clipboard failed'); }
    },
  });
  push(cap('genysys-security-stack'), { title: 'Security surface', meta: 'Policy and isolation', badge: 'Security', action: () => window.openGENYSYSSettingsSection?.('#settings-section-privacy') });
  push(cap('genysys-extensions'), { title: 'Extensions', meta: 'Local extension hooks', badge: 'Ext', action: () => window.openGENYSYSSettingsSection?.('#settings-section-genysys') });
  push(cap('genysys-communication'), { title: 'Communications', meta: 'Comms placeholders', badge: 'Comms', action: () => window.openGENYSYSCommunicationSection?.() });
  push(cap('genysys-ai-assistant') || cap('genysys-automation'), { title: 'Automation / AI', meta: 'Local automation hooks', badge: 'Auto', action: () => window.openGENYSYSSettingsSection?.('#settings-section-advanced') });

  // Recent history shortcuts
  for (const item of recentHistory.slice(0, 3)) {
    push(true, {
      title: item.title || item.url,
      meta: 'Recent',
      badge: 'History',
      action: () => window.tabManager.createTab(item.url),
    });
  }

  return suggestions.slice(0, 12);
};

// ── Header dropdown rendering ─────────────────────────────────────────────────

function escapeHtmlAttr(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

window.renderGENYSYSSpotlight = function renderGENYSYSSpotlight() {
  const feed = document.getElementById('spotlight-feed');
  if (!feed) return;

  const activeTab = window.getActiveBrowserTab?.();
  const contextLine = document.getElementById('spotlight-context-line');
  if (contextLine) {
    contextLine.textContent = activeTab
      ? `${activeTab.title || 'Current tab'} • ${window.getTabHost(activeTab) || 'local page'}`
      : 'No active tab yet. Open one to unlock contextual suggestions.';
  }

  const suggestions = window.getGENYSYSSpotlightSuggestions?.() || [];
  feed.innerHTML = suggestions.map((s, i) => `
    <button type="button" class="spotlight-item" data-idx="${i}">
      <span class="spotlight-item-badge">${escapeHtmlAttr(s.badge || '•')}</span>
      <span class="spotlight-item-body">
        <span class="spotlight-item-title">${escapeHtmlAttr(s.title)}</span>
        <span class="spotlight-item-meta">${escapeHtmlAttr(s.meta || '')}</span>
      </span>
    </button>
  `).join('') || '<p class="spotlight-empty">No spotlight actions</p>';

  feed.querySelectorAll('.spotlight-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = suggestions[Number(btn.getAttribute('data-idx'))];
      closeSpotlightDropdown();
      s?.action?.();
    });
  });
};

// Back-compat alias — old sidebar refresh paths now refresh the header dropdown.
window.renderGENYSYSSidebarSpotlight = window.renderGENYSYSSpotlight;

// ── Open / close behavior ─────────────────────────────────────────────────────

function isSpotlightOpen() {
  const dropdown = document.getElementById('spotlight-dropdown');
  return Boolean(dropdown && dropdown.dataset.open === '1');
}

function openSpotlightDropdown() {
  const dropdown = document.getElementById('spotlight-dropdown');
  const btn = document.getElementById('spotlight-btn');
  if (!dropdown) return;
  const search = document.getElementById('spotlight-search');
  if (search) search.value = '';
  window.renderGENYSYSSpotlight();
  dropdown.dataset.open = '1';
  dropdown.classList.remove('hidden');
  dropdown.removeAttribute('hidden');
  dropdown.style.removeProperty('display');
  btn?.classList.add('active');
  setTimeout(() => document.getElementById('spotlight-search')?.focus(), 30);
}

function closeSpotlightDropdown() {
  const dropdown = document.getElementById('spotlight-dropdown');
  const btn = document.getElementById('spotlight-btn');
  if (!dropdown) return;
  dropdown.dataset.open = '0';
  dropdown.classList.add('hidden');
  dropdown.setAttribute('hidden', '');
  dropdown.style.setProperty('display', 'none', 'important');
  btn?.classList.remove('active');
}

function toggleSpotlightDropdown() {
  if (isSpotlightOpen()) closeSpotlightDropdown();
  else openSpotlightDropdown();
}

window.toggleGENYSYSSpotlight = toggleSpotlightDropdown;
window.closeGENYSYSSpotlight = closeSpotlightDropdown;

function filterSpotlightItems(query) {
  const feed = document.getElementById('spotlight-feed');
  if (!feed) return;
  const q = String(query || '').trim().toLowerCase();
  feed.querySelectorAll('.spotlight-item').forEach((item) => {
    const match = !q || item.textContent.toLowerCase().includes(q);
    item.classList.toggle('hidden', !match);
  });
}

function initSpotlightDropdown() {
  const btn = document.getElementById('spotlight-btn');
  const closeBtn = document.getElementById('spotlight-close');
  const search = document.getElementById('spotlight-search');
  if (!btn) return;

  const shut = (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeSpotlightDropdown();
  };

  if (!btn.dataset.spotlightBound) {
    btn.dataset.spotlightBound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSpotlightDropdown();
    });
    search?.addEventListener('input', (e) => filterSpotlightItems(e.target.value));
    search?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSpotlightDropdown();
      }
      if (e.key === 'Enter') {
        const first = document.querySelector('#spotlight-feed .spotlight-item:not(.hidden)');
        first?.click();
      }
    });
    document.addEventListener('mousedown', (e) => {
      if (!isSpotlightOpen()) return;
      const target = e.target;
      if (target?.closest?.('#spotlight-dropdown') || target?.closest?.('#spotlight-btn')) return;
      closeSpotlightDropdown();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isSpotlightOpen()) closeSpotlightDropdown();
    });
    window.addEventListener('genysys:tab-activated', () => {
      if (isSpotlightOpen()) window.renderGENYSYSSpotlight();
    });
  }

  if (closeBtn && !closeBtn.dataset.spotlightBound) {
    closeBtn.dataset.spotlightBound = '1';
    closeBtn.addEventListener('mousedown', shut, true);
    closeBtn.addEventListener('click', shut, true);
  }

  closeSpotlightDropdown();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSpotlightDropdown, { once: true });
} else {
  initSpotlightDropdown();
}
