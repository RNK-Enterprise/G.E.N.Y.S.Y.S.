/**
 * VEIL™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Sidebar Spotlight renderer removed — Spotlight now lives in the header
 * dropdown (see shell/spotlight-suggestions.js).
 */

function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function highlightSidebarMatch(text, query) {
    const safeText = escapeHtml(text);
    const safeQuery = String(query || '').trim();
    if (!safeQuery) return safeText;

    const escapedQuery = safeQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(${escapedQuery})`, 'ig');
    return safeText.replace(pattern, '<mark>$1</mark>');
}

window.escapeHtml = escapeHtml;
window.highlightSidebarMatch = highlightSidebarMatch;
