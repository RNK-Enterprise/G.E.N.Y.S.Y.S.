/**
 * GENYSYS™ — RNK Product Webviews (Ops / People / Comms sections)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * GENYSYS is RNK's only client: Raven and Echonet open HERE, inside GENYSYS, as
 * privileged-tab webviews. A normal browser hitting these hosts is refused by
 * the products' attestation checks (X-GENYSYS-Client / X-GENYSYS-Session).
 *
 * Native shell (Tauri): dedicated WebviewWindow per product.
 * Vite preview (no shell): an honest degraded state, not a fake success.
 */

const SECTION_TARGETS = {
    operations: {
        host: 'raven.rnk-enterprise.us',
        path: '/dashboard',
        title: 'Raven — Operations',
    },
    people: {
        host: 'raven.rnk-enterprise.us',
        path: '/hr',
        title: 'Raven — People',
    },
    comms: {
        host: 'echonet.rnk-enterprise.us',
        path: '/',
        title: 'Echonet — Comms',
    },
};

function productUrl(target) {
    return `https://${target.host}${target.path}`;
}

async function createGENYSYSWindow(url, label) {
    if (window.__TAURI__?.Window) {
        try {
            const { WebviewWindow } = await import('@tauri-apps/api/window');
            const win = new WebviewWindow(`genysys-${label}`, {
                url,
                title: `GENYSYS — ${label}`,
                width: 1280,
                height: 820,
            });
            return true;
        } catch (e) {
            console.warn(`[GENYSYS Webviews] window create failed for ${label}:`, e);
            return false;
        }
    }
    // Same-host iframe fallback (works inside the shell's dist build too).
    try {
        const frame = document.createElement('iframe');
        frame.src = url;
        frame.className = 'webview rnk-webview';
        frame.setAttribute('aria-label', `RNK product — ${label}`);
        frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
        const container = document.getElementById('rnk-webview-host');
        if (!container) return false;
        container.innerHTML = '';
        container.appendChild(frame);
        return true;
    } catch {
        return false;
    }
}

export function mountRnkWebview(sectionId) {
    const mount = document.getElementById(`rnk-webview-${sectionId}`);
    if (!mount) return;
    const target = SECTION_TARGETS[sectionId];
    if (!target) return;

    mount.innerHTML = `
        <div class="rnk-webview-shell">
            <div class="rnk-webview-bar">
                <span class="rnk-webview-badge">Privileged — RNK product surface</span>
                <span class="rnk-webview-url">${productUrl(target)}</span>
                <button class="sc-btn" id="rnk-webview-open-${sectionId}">Open in GENYSYS</button>
            </div>
            <div class="rnk-webview-host" id="rnk-webview-host"></div>
            <div class="rnk-webview-note" id="rnk-webview-note-${sectionId}" hidden></div>
        </div>`;

    const open = async () => {
        const ok = await createGENYSYSWindow(productUrl(target), target.title);
        const note = mount.querySelector(`#rnk-webview-note-${sectionId}`);
        if (note) {
            if (ok) {
                note.hidden = true;
            } else {
                note.hidden = false;
                note.textContent =
                    'RNK product unreachable from this preview — open the full GENYSYS shell. ' +
                    'These hosts refuse non-GENYSYS browsers by design.';
            }
        }
    };

    mount.querySelector(`#rnk-webview-open-${sectionId}`)?.addEventListener('click', open);
    open();
}
