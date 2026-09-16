/**
 * VEIL™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import DownloadManager from '../download-manager.js';
import BookmarkManager from '../bookmark-manager.js';
import SettingsManager from '../settings-manager.js';
import HistoryManager from '../history-manager.js';
import SessionManager from '../session/session-manager.js';
import RecentlyClosedManager from '../session/recently-closed-manager.js';

window.downloadManager = new DownloadManager();
window.bookmarkManager = new BookmarkManager();
window.settingsManager = new SettingsManager();
window.historyManager = new HistoryManager();
window.sessionManager = new SessionManager();
window.recentlyClosedManager = new RecentlyClosedManager();
