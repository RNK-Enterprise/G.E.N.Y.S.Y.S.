/**
 * GENYSYS™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */
window.bindModalCloseButtons();

// Click outside modal to close
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            window.hideModal(modal);
        }
    });
});

function showRecentlyClosedModal() {
    if (!window.isGENYSYSCapabilityAvailable('genysys-history')) {
        return;
    }

    const modal = document.getElementById('recently-closed-modal');
    const list = document.getElementById('recently-closed-list');
    const closed = window.recentlyClosedManager.getRecentlyClosed();
    
    list.innerHTML = '';
    
    if (closed.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">LIST</div>
                <div class="empty-title">No Recently Closed Tabs</div>
                <div class="empty-message">Closed tabs will appear here for quick restoration</div>
            </div>
        `;
    } else {
        closed.forEach((tab, index) => {
            const item = document.createElement('div');
            item.className = 'modal-list-item';
            
            const favicon = tab.favicon ? 
                `<img src="${tab.favicon}" class="tab-favicon" alt="" onerror="this.style.display='none'">` : 
                '<span class="tab-favicon">WEB</span>';
            
            const date = new Date(tab.timestamp).toLocaleString();
            
            item.innerHTML = `
                ${favicon}
                <div class="modal-item-info">
                    <div class="modal-item-title">${tab.title}</div>
                    <div class="modal-item-url">${tab.url}</div>
                    <div class="modal-item-time">${date}</div>
                </div>
                <button class="modal-item-action" data-url="${tab.url}" aria-label="Restore tab">Restore</button>
            `;
            
            window.bindModalActionButton(item, '.modal-item-action', () => {
                window.loadingManager.show('Restoring tab...');
                setTimeout(() => {
                    window.tabManager.createTab(tab.url);
                    window.hideModal(modal);
                    window.loadingManager.hide();
                    window.toastManager.success('Tab Restored', `${tab.title} has been restored`);
                }, 300);
            });
            
            list.appendChild(item);
        });
        
        const clearBtn = document.createElement('button');
        clearBtn.className = 'action-btn danger';
        clearBtn.textContent = 'Clear History';
        clearBtn.setAttribute('aria-label', 'Clear recently closed history');
        window.bindButtonAction(clearBtn, () => {
            window.recentlyClosedManager.clearHistory();
            showRecentlyClosedModal();
            window.toastManager.info('History Cleared', 'Recently closed tabs have been cleared');
        });
        list.appendChild(clearBtn);
    }
    
    window.showElement(modal);
}

function showSessionsModal() {
    if (!window.isGENYSYSCapabilityAvailable('genysys-browser-core')) {
        return;
    }

    const modal = document.getElementById('sessions-modal');
    const list = document.getElementById('sessions-list');
    const sessions = window.sessionManager.listSessions();
    
    list.innerHTML = '';
    
    if (sessions.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">SAVE</div>
                <div class="empty-title">No Saved Sessions</div>
                <div class="empty-message">Save your current tabs as a session using Ctrl+Shift+S</div>
            </div>
        `;
    } else {
        sessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'modal-list-item';
            
            const date = new Date(session.timestamp).toLocaleString();
            
            item.innerHTML = `
                <div class="modal-item-info">
                    <div class="modal-item-title">${session.name}</div>
                    <div class="modal-item-subtitle">${session.tabCount} tabs • ${date}</div>
                </div>
                <button class="modal-item-action" data-session="${session.name}" aria-label="Load session">Load</button>
                <button class="modal-item-action danger" data-session="${session.name}" aria-label="Delete session">Delete</button>
            `;
            
            window.bindModalActionButton(item, '.modal-item-action', () => {
                const sessionData = window.sessionManager.loadSession(session.name);
                if (sessionData) {
                    window.loadingManager.show(`Loading session "${session.name}"...`);
                    
                    // Close all tabs
                    while (window.tabManager.tabs.length > 0) {
                        const tab = window.tabManager.tabs[0];
                        if (tab.iframe) tab.iframe.remove();
                        window.tabManager.tabs.splice(0, 1);
                    }
                    
                    // Load session tabs with staggered animation
                    sessionData.tabs.forEach((tabData, index) => {
                        setTimeout(() => {
                            window.tabManager.createTab(tabData.url);
                            window.loadingManager.update(`Loading tab ${index + 1} of ${sessionData.tabs.length}...`);
                            
                            if (index === sessionData.tabs.length - 1) {
                                setTimeout(() => {
                                    window.loadingManager.hide();
                                    window.hideModal(modal);
                                    window.toastManager.success('Session Loaded', `${session.name} with ${sessionData.tabs.length} tabs`);
                                }, 300);
                            }
                        }, index * 100);
                    });
                    
                    updateStatusBar(`Loaded session: ${session.name}`);
                }
            });
            
            window.bindModalActionButton(item, '.modal-item-action.danger', () => {
                if (confirm(`Delete session "${session.name}"?`)) {
                    window.sessionManager.deleteSession(session.name);
                    showSessionsModal();
                    window.toastManager.info('Session Deleted', `${session.name} has been removed`);
                }
            });
            
            list.appendChild(item);
        });
    }
    
    window.showElement(modal);
}
// ===================================================================
// Navigation (Week 3 - Enhanced with Auto-Complete)
// ===================================================================
window.omnibox = document.getElementById('omnibox');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const refreshBtn = document.getElementById('refresh-btn');
const homeBtn = document.getElementById('home-btn');
const suggestionsDropdown = document.getElementById('omnibox-suggestions');

// Search Provider Management
window.currentSearchProvider = localStorage.getItem('search-provider') || 'duckduckgo';
window.searchProviders = {
    google: { name: 'Google', icon: 'G', url: 'https://www.google.com/search?q=' },
    duckduckgo: { name: 'DuckDuckGo', icon: 'D', url: 'https://duckduckgo.com/?q=' },
    bing: { name: 'Bing', icon: 'B', url: 'https://www.bing.com/search?q=' },
    brave: { name: 'Brave Search', icon: 'B', url: 'https://search.brave.com/search?q=' }
};

function updateSearchProviderIcon() {
    const btn = document.getElementById('search-provider-btn');
    if (!btn) return;
    btn.textContent = window.searchProviders[window.currentSearchProvider].icon;
    btn.title = `Search with ${window.searchProviders[window.currentSearchProvider].name}`;
}

updateSearchProviderIcon();

// Search Provider Selection
window.bindItemEvents(document.querySelectorAll('.provider-item'), {
    click: (item) => {
        window.currentSearchProvider = item.getAttribute('data-provider');
        localStorage.setItem('search-provider', window.currentSearchProvider);
        updateSearchProviderIcon();
        window.closeSearchProviderModal();
        updateStatusBar(`Search provider: ${window.searchProviders[window.currentSearchProvider].name}`);
    }
});

// Omnibox Auto-Complete
window.selectedSuggestionIndex = -1;

window.omnibox.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    
        if (query.length < 2) {
        window.hideElement(suggestionsDropdown);
        return;
    }
    
    // Get suggestions from history and bookmarks
    const historySuggestions = window.historyManager.search(query).slice(0, 5);
    const bookmarkSuggestions = window.bookmarkManager.getAllBookmarks()
        .filter(b => b.title.toLowerCase().includes(query) || b.url.toLowerCase().includes(query))
        .slice(0, 3);
    
    const suggestions = [...historySuggestions, ...bookmarkSuggestions];
    
    if (suggestions.length === 0) {
        window.hideElement(suggestionsDropdown);
        return;
    }
    
    // Render suggestions
    suggestionsDropdown.innerHTML = '';
    suggestions.forEach((item, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        suggestionItem.innerHTML = `
            <span class="suggestion-icon">${item.folder ? 'DIR' : 'WEB'}</span>
            <div class="suggestion-info">
                <div class="suggestion-title">${highlightMatch(item.title, query)}</div>
                <div class="suggestion-url">${highlightMatch(item.url, query)}</div>
            </div>
        `;
        
        suggestionsDropdown.appendChild(suggestionItem);
    });

    window.bindItemEvents(suggestionsDropdown.querySelectorAll('.suggestion-item'), {
        click: (item) => {
            const url = item.querySelector('.suggestion-url')?.textContent?.trim();
            if (url) {
                navigateToUrl(url);
                window.hideElement(suggestionsDropdown);
            }
        },
        mouseenter: (_, index) => {
            window.selectedSuggestionIndex = index;
            updateSelectedSuggestion();
        }
    });
    
    window.selectedSuggestionIndex = -1;
    window.showElement(suggestionsDropdown);
});

function highlightMatch(text, query) {
    const index = text.toLowerCase().indexOf(query);
    if (index === -1) return text;
    
    return text.substring(0, index) + 
           '<mark>' + text.substring(index, index + query.length) + '</mark>' + 
           text.substring(index + query.length);
}

function updateSelectedSuggestion() {
    const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
        if (index === window.selectedSuggestionIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

window.omnibox.addEventListener('keydown', (e) => {
    const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length > 0) {
            window.selectedSuggestionIndex = Math.min(window.selectedSuggestionIndex + 1, items.length - 1);
            updateSelectedSuggestion();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length > 0) {
            window.selectedSuggestionIndex = Math.max(window.selectedSuggestionIndex - 1, -1);
            updateSelectedSuggestion();
        }
    } else if (e.key === 'Escape') {
        window.hideElement(suggestionsDropdown);
    }
});

window.omnibox.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        // Check if suggestion is selected
        if (window.selectedSuggestionIndex >= 0) {
            const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
            if (items[window.selectedSuggestionIndex]) {
                const url = items[window.selectedSuggestionIndex].querySelector('.suggestion-url').textContent.trim();
                navigateToUrl(url);
                window.hideElement(suggestionsDropdown);
                return;
            }
        }
        
        let url = window.omnibox.value.trim();
        
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            // Check if it looks like a URL
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                // Treat as search
                url = window.searchProviders[window.currentSearchProvider].url + encodeURIComponent(url);
            }
        }
        
        navigateToUrl(url);
        window.hideElement(suggestionsDropdown);
    }
});

window.bindClickHandlers([
    [backBtn, () => window.tabManager.goBack()]
]);

window.bindClickHandlers([
    [forwardBtn, () => window.tabManager.goForward()],
    [refreshBtn, () => window.tabManager.refresh()],
    [homeBtn, () => navigateToUrl('genysys://newtab')]
]);

// Bookmark Button

window.showRecentlyClosedModal = showRecentlyClosedModal;
window.showSessionsModal = showSessionsModal;
window.updateSearchProviderIcon = updateSearchProviderIcon;
window.highlightMatch = highlightMatch;
window.updateSelectedSuggestion = updateSelectedSuggestion;
