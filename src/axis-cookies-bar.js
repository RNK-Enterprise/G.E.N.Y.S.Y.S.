/**
 * Axis™ — Cookies Compliance Bar
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

const ACCEPTED_KEY = 'axis-cookies-accepted';

function createBar() {
    const bar = document.createElement('div');
    bar.id = 'axis-cookies-bar';
    bar.innerHTML = `
        <span class="axis-cookies-text">
            Axis uses local storage to remember your preferences and session state.
            No data is sent to third parties.
            <a href="https://rnk-enterprise.us/privacy" target="_blank" rel="noopener">Privacy Policy</a>
        </span>
        <button id="axis-cookies-accept" type="button">Accept</button>
    `;
    document.body.appendChild(bar);
    document.getElementById('axis-cookies-accept').addEventListener('click', () => {
        localStorage.setItem(ACCEPTED_KEY, '1');
        bar.classList.add('axis-cookies-hidden');
        setTimeout(() => bar.remove(), 300);
    });
}

if (!localStorage.getItem(ACCEPTED_KEY)) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createBar, { once: true });
    } else {
        createBar();
    }
}
