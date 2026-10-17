/**
 * GENYSYS™ — Cookies Compliance Bar
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

const ACCEPTED_KEY = 'genysys-cookies-accepted';

function createBar() {
    const bar = document.createElement('div');
    bar.id = 'genysys-cookies-bar';
    bar.innerHTML = `
        <span class="genysys-cookies-text">
            G.E.N.E.S.Y.S. uses local storage to remember your preferences and session state.
            No data is sent to third parties.
            <a href="https://rnk-enterprise.us/privacy" target="_blank" rel="noopener">Privacy Policy</a>
        </span>
        <button id="genysys-cookies-accept" type="button">Accept</button>
    `;
    document.body.appendChild(bar);
    document.getElementById('genysys-cookies-accept').addEventListener('click', () => {
        localStorage.setItem(ACCEPTED_KEY, '1');
        bar.classList.add('genysys-cookies-hidden');
        setTimeout(() => bar.remove(), 300);
    });
}

if (!localStorage.getItem(ACCEPTED_KEY)) {
    // One-time lift of the pre-rename acceptance marker (Axis → GENYSYS, 2026-09).
    const legacyAccepted = localStorage.getItem('axis-cookies-accepted');
    if (legacyAccepted) {
        localStorage.setItem('genysys-cookies-accepted', legacyAccepted);
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
