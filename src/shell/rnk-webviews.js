/**
 * VEIL™ — RNK Product Webviews (Ops / People / Comms sections)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * VEIL is RNK's only client: Raven and Echonet open HERE, inside VEIL, as
 * privileged-tab webviews. A normal browser hitting these hosts is refused by
 * the products' attestation checks (X-VEIL-Client / X-VEIL-Session).
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

async function createVEILWindow(url, label) {
    if (window.__TAURI__?.Window) {
        try {
            const { WebviewWindow } = await import('@tauri-apps/api/window');
            const win = new WebviewWindow(`veil-${label}`, {
                url,
                title: `VEIL — ${label}`,
                width: 1280,
                height: 820,
            });
            return true;
        } catch (e) {
            console.warn(`[VEIL Webviews] window create failed for ${label}:`, e);
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
                <button class="sc-btn" id="rnk-webview-open-${sectionId}">Open in VEIL</button>
            </div>
            <div class="rnk-webview-host" id="rnk-webview-host"></div>
            <div class="rnk-webview-note" id="rnk-webview-note-${sectionId}" hidden></div>
        </div>`;

    const open = async () => {
        const ok = await createVEILWindow(productUrl(target), target.title);
        const note = mount.querySelector(`#rnk-webview-note-${sectionId}`);
        if (note) {
            if (ok) {
                note.hidden = true;
            } else {
                note.hidden = false;
                note.textContent =
                    'RNK product unreachable from this preview — open the full VEIL shell. ' +
                    'These hosts refuse non-VEIL browsers by design.';
            }
        }
    };

    mount.querySelector(`#rnk-webview-open-${sectionId}`)?.addEventListener('click', open);
    open();
}
