/**
 * RNK VEIL™
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 * 
 * Bookmark Manager
 */

export class BookmarkManager {
    constructor() {
        this.bookmarks = this.loadBookmarks();
        this.folders = ['favorites', 'work', 'personal', 'dev'];
    }

    loadBookmarks() {
        try {
            const saved = localStorage.getItem('rnk-veil-bookmarks') ?? localStorage.getItem('rnk-axis-bookmarks') ?? localStorage.getItem('rnk-atlas-bookmarks');
            return saved ? JSON.parse(saved) : this.getDefaultBookmarks();
        } catch {
            return this.getDefaultBookmarks();
        }
    }

    saveBookmarks() {
        try {
            localStorage.setItem('rnk-veil-bookmarks', JSON.stringify(this.bookmarks));
        } catch (error) {
            console.error('Failed to save bookmarks:', error);
        }
    }

    getDefaultBookmarks() {
        return [
            {
                id: 1,
                title: 'Google',
                url: 'https://www.google.com',
                folder: 'favorites',
                favicon: null,
                created: Date.now()
            },
            {
                id: 2,
                title: 'GitHub',
                url: 'https://github.com',
                folder: 'dev',
                favicon: null,
                created: Date.now()
            }
        ];
    }

    addBookmark(title, url, folder = 'favorites') {
        const bookmark = {
            id: Date.now(),
            title: title,
            url: url,
            folder: folder,
            favicon: null,
            created: Date.now()
        };

        this.bookmarks.push(bookmark);
        this.saveBookmarks();
        this.emitEvent('bookmark-added', bookmark);
        return bookmark;
    }

    removeBookmark(id) {
        const index = this.bookmarks.findIndex(b => b.id === id);
        if (index !== -1) {
            const bookmark = this.bookmarks[index];
            this.bookmarks.splice(index, 1);
            this.saveBookmarks();
            this.emitEvent('bookmark-removed', bookmark);
        }
    }

    isBookmarked(url) {
        return this.bookmarks.some(b => b.url === url);
    }

    getBookmark(url) {
        return this.bookmarks.find(b => b.url === url);
    }

    getBookmarksByFolder(folder) {
        return this.bookmarks.filter(b => b.folder === folder);
    }

    getAllBookmarks() {
        return this.bookmarks;
    }

    searchBookmarks(query) {
        const lowerQuery = query.toLowerCase();
        return this.bookmarks.filter(b => 
            b.title.toLowerCase().includes(lowerQuery) ||
            b.url.toLowerCase().includes(lowerQuery)
        );
    }

    emitEvent(eventName, data) {
        window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }
}

export default BookmarkManager;
