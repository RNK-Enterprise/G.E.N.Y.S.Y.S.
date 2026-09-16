/**
 * VEIL™ — Cookies Compliance Bar
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

const ACCEPTED_KEY = 'veil-cookies-accepted';

function createBar() {
    const bar = document.createElement('div');
    bar.id = 'veil-cookies-bar';
    bar.innerHTML = `
        <span class="veil-cookies-text">
            VEIL uses local storage to remember your preferences and session state.
            No data is sent to third parties.
            <a href="https://rnk-enterprise.us/privacy" target="_blank" rel="noopener">Privacy Policy</a>
        </span>
        <button id="veil-cookies-accept" type="button">Accept</button>
    `;
    document.body.appendChild(bar);
    document.getElementById('veil-cookies-accept').addEventListener('click', () => {
        localStorage.setItem(ACCEPTED_KEY, '1');
        bar.classList.add('veil-cookies-hidden');
        setTimeout(() => bar.remove(), 300);
    });
}

if (!localStorage.getItem(ACCEPTED_KEY)) {
    // One-time lift of the pre-rename acceptance marker (Axis → VEIL, 2026-09).
    const legacyAccepted = localStorage.getItem('axis-cookies-accepted');
    if (legacyAccepted) {
        localStorage.setItem('veil-cookies-accepted', legacyAccepted);
        localStorage.removeItem('axis-cookies-accepted');
    }
    if (legacyAccepted) {
        localStorage.setItem(ACCEPTED_KEY, legacyAccepted);
    }
}

if (!localStorage.getItem(ACCEPTED_KEY)) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createBar, { once: true });
    } else {
        createBar();
    }
}
