/**
 * GENYSYS™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

import { mountServerControl, unmountServerControl } from '../genysys-server-control.js';
import { mountProtectsHealth } from '../lisa/protects-health.js';
import { mountRnkWebview } from './rnk-webviews.js';
import { mountAdminOps } from '../genysys-admin-ops.js';

window.activeSection = 'browser';

function activateSection(sectionId) {
    document.querySelectorAll('.genysys-section').forEach(el => {
        el.classList.toggle('active', el.id === `section-${sectionId}`);
        el.classList.toggle('hidden', el.id !== `section-${sectionId}`);
    });
    document.querySelectorAll('.section-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });
    window.activeSection = sectionId;
    if (sectionId === 'server-control') {
        mountServerControl('server-control-mount');
    } else {
        unmountServerControl();
    }
    if (sectionId === 'lisa') {
        // Lisa section = P.R.O.T.E.C.T.S. organ health (Resolute-backed),
        // not a chat stub.
        mountProtectsHealth(document.getElementById('lisa-section-mount'));
    }
    if (sectionId === 'admin') {
        // Local ops/audit plane (tier-gated inside mountAdminOps).
        const tier = window.genysysAuthSession?.tier ||
            JSON.parse(sessionStorage.getItem('rnk-genysys-auth-session') || '{}').tier;
        mountAdminOps(document.getElementById('admin-section-mount'), tier);
    }
    if (['operations', 'people', 'comms'].includes(sectionId)) {
        // Raven / Echonet open INSIDE GENYSYS — privileged product webviews.
        mountRnkWebview(sectionId);
    }
    // Tab windows live above the chrome: hide them outside the Browser
    // section, show the active one again on return.
    if (window.tabWindowBridge) {
        if (sectionId === 'browser') {
            window.tabWindowBridge.onSectionEnter();
        } else {
            window.tabWindowBridge.onSectionLeave();
        }
    }
    if (typeof window.genysysSectionChanged === 'function') {
        window.genysysSectionChanged(sectionId);
    } else {
        // Hook is optional; keep legacy listeners working via the DOM event.
        document.dispatchEvent(new CustomEvent('genysys:section-changed', {
            detail: { sectionId },
        }));
    }
}

function setupSectionNav() {
    const nav = document.getElementById('section-nav');
    if (!nav) return;
    nav.addEventListener('click', e => {
        const btn = e.target.closest('.section-nav-btn');
        if (!btn) return;
        activateSection(btn.dataset.section);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSectionNav, { once: true });
} else {
    setupSectionNav();
}
async function setupWindowControls() {
    await window.initTauriAPI();
    const doSetup = () => {
        if (window.__genysysWindowControlsBound) return;
        window.__genysysWindowControlsBound = true;
        window.bindClickHandlers([
            ['minimize-btn', (e) => { e.stopPropagation(); return window.invoke('window_minimize'); }],
            ['maximize-btn', (e) => { e.stopPropagation(); return window.invoke('window_maximize'); }],
            ['close-btn',    (e) => { e.stopPropagation(); return window.invoke('window_close'); }],
        ]);
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', doSetup, { once: true });
    } else {
        doSetup();
    }
}

setupWindowControls();

window.setupSectionNav = setupSectionNav;
window.activateSection = activateSection;
window.setupWindowControls = setupWindowControls;
window.mountServerControl = mountServerControl;
window.unmountServerControl = unmountServerControl;
window.mountProtectsHealth = mountProtectsHealth;
window.mountRnkWebview = mountRnkWebview;
