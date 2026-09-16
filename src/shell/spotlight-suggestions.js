/**
 * VEIL™ — Spotlight (header dropdown)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Contextual actions for the active tab, surfaced from a ⚡ button in the
 * titlebar. Replaces the old sidebar Spotlight section.
 */

window.getVEILSpotlightSuggestions = function getVEILSpotlightSuggestions() {
  const activeTab = window.getActiveBrowserTab?.();
  const recentHistory = window.veilSpotlightCaps('veil-history')
    ? (window.historyManager?.getRecent?.(8) || window.historyManager?.recent || [])
    : [];
  const downloadSummary = window.veilSpotlightCaps('veil-downloads')
    ? (window.getVEILDownloadSummary?.() || { downloads: [] })
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
  const context = window.getVEILSpotlightContext?.(host, title, url) || 'general';
  const suggestions = [];
  const isBookmarked = url ? window.bookmarkManager?.isBookmarked?.(url) : false;
  const push = (cond, item) => window.veilSpotlightPush(suggestions, cond, item);
  const cap = window.veilSpotlightCaps;

  push(true, { title: 'Focus omnibox', meta: url || 'Type a destination', badge: 'Nav', action: () => window.focusOmniboxOnly?.() });
  push(true, { title: 'New tab', meta: 'Open another browsing surface', badge: 'Shell', action: () => window.tabManager.createTab() });
  push(!!url && cap('veil-bookmarks'), {
    title: isBookmarked ? 'Remove bookmark' : 'Bookmark this page',
    meta: host || url,
    badge: 'Bookmarks',
    action: () => (isBookmarked ? window.bookmarkManager?.removeBookmark?.((window.bookmarkManager?.getBookmark?.(url) || {}).id) : window.bookmarkManager?.addBookmark?.(title, url)),
  });
  push(cap('veil-history'), { title: 'Recently closed', meta: 'Restore closed tabs', badge: 'History', action: () => window.showRecentlyClosedModal?.() });
  push(cap('veil-downloads'), { title: 'Open downloads', meta: `${(downloadSummary.downloads || []).length} items`, badge: 'Downloads', action: () => window.openVEILDownloadsSection?.() });
  push(cap('veil-performance-stack'), { title: 'Performance panel', meta: 'Live turbos and metrics', badge: 'Perf', action: () => window.togglePerformancePanel?.() });
  push(true, { title: 'Settings', meta: 'Preferences and density', badge: 'Settings', action: () => window.openSettings?.() });
  push(context === 'workspace' && cap('veil-history'), { title: 'Related history', meta: 'Pages on this trail', badge: 'History', action: () => window.showRecentlyClosedModal?.() });
  push(!!url && !!navigator.clipboard?.writeText, {
    title: 'Copy page URL',
    meta: url,
    badge: 'Link',
    action: async () => {
      try { await navigator.clipboard.writeText(url); window.updateStatusBar?.('Link copied'); }
      catch { window.updateStatusBar?.('Clipboard failed'); }
    },
  });
  push(cap('veil-security-stack'), { title: 'Security surface', meta: 'Policy and isolation', badge: 'Security', action: () => window.openVEILSettingsSection?.('#settings-section-privacy') });
  push(cap('veil-extensions'), { title: 'Extensions', meta: 'Local extension hooks', badge: 'Ext', action: () => window.openVEILSettingsSection?.('#settings-section-veil') });
  push(cap('veil-communication'), { title: 'Communications', meta: 'Comms placeholders', badge: 'Comms', action: () => window.openVEILCommunicationSection?.() });
  push(cap('veil-ai-assistant') || cap('veil-automation'), { title: 'Automation / AI', meta: 'Local automation hooks', badge: 'Auto', action: () => window.openVEILSettingsSection?.('#settings-section-advanced') });

  // Recent history shortcuts
  for (const item of (recentHistory || []).slice(0, 3)) {
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

window.renderVEILSpotlight = function renderVEILSpotlight() {
  const feed = document.getElementById('spotlight-feed');
  if (!feed) return;

  const activeTab = window.getActiveBrowserTab?.();
  const contextLine = document.getElementById('spotlight-context-line');
  if (contextLine) {
    contextLine.textContent = activeTab
      ? `${activeTab.title || 'Current tab'} • ${window.getTabHost(activeTab) || 'local page'}`
      : 'No active tab yet. Open one to unlock contextual suggestions.';
  }

  const suggestions = window.getVEILSpotlightSuggestions?.() || [];
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
window.renderVEILSidebarSpotlight = window.renderVEILSpotlight;

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
  window.renderVEILSpotlight();
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

window.toggleVEILSpotlight = toggleSpotlightDropdown;
window.closeVEILSpotlight = closeSpotlightDropdown;

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
      if (e.target.closest('#spotlight-dropdown') || e.target.closest('#spotlight-btn')) return;
      closeSpotlightDropdown();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isSpotlightOpen()) closeSpotlightDropdown();
    });
    window.addEventListener('veil:tab-activated', () => {
      if (isSpotlightOpen()) window.renderVEILSpotlight();
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
