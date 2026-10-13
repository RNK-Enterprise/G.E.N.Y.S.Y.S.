/**
 * GENYSYS™ — bookmarks bar renderer (omnibox toolbar)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * The old sidebar bookmark feed died with the GENYSYS SHELL sidebar; only the
 * real bookmarks bar renderer remains.
 */

function renderBookmarksBar() {
    const bar = document.getElementById('bookmarks-bar');
    const list = document.getElementById('bookmarks-bar-list');
    const count = document.getElementById('bookmarks-bar-count');
    if (!bar || !list || !count) return;

    const settings = window.settingsManager.getAll();
    const bookmarksVisible = Boolean(settings.general.showBookmarksBar);

    bar.classList.toggle('hidden', !bookmarksVisible || !window.isGENYSYSCapabilityAvailable('genysys-bookmarks'));
    if (!bookmarksVisible || !window.isGENYSYSCapabilityAvailable('genysys-bookmarks')) {
        list.innerHTML = '';
        count.textContent = '0';
        window.applyBookmarksBarDensityState();
        return;
    }

    const items = window.bookmarkManager.getAllBookmarks();
    count.textContent = String(items.length);
    list.innerHTML = '';

    if (items.length === 0) {
        list.innerHTML = '<span class="bookmarks-bar-empty">No bookmarks yet</span>';
        return;
    }

    items.slice(0, 12).forEach((bookmark) => {
        const button = document.createElement('button');
        button.className = 'bookmarks-bar-item';
        button.type = 'button';
        button.title = bookmark.url;
        let label = bookmark.title || bookmark.url;
        if (!bookmark.title) {
            try {
                label = new URL(bookmark.url).hostname || bookmark.url;
            } catch {
                label = bookmark.url;
            }
        }
        button.textContent = label;
        window.bindButtonAction(button, () => window.tabManager.createTab(bookmark.url));
        list.appendChild(button);
    });

    window.applyBookmarksBarDensityState();
}
window.renderBookmarksBar = renderBookmarksBar;
