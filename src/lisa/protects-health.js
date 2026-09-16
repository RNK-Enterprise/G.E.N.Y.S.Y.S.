/**
 * VEIL™ — P.R.O.T.E.C.T.S. Health Panel (Lisa section)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * The Lisa section is NOT a chatbot. It renders P.R.O.T.E.C.T.S. organ health
 * with Resolute Authentication Core as the handshake organ. Data comes from
 * the native shell (tauri check_protects_health) which probes Resolute
 * directly. No chat stub ships as production.
 */

const RESOLUTE_URL = () =>
    localStorage.getItem('veil_resolute_url')     || localStorage.getItem('axis_resolute_url') || 'http://127.0.0.1:7781';

const ORGANS = [
    { key: 'resolute', label: 'Resolute Authentication Core', icon: '🔑', note: 'Handshake organ — C.O.M.M.A.N.D. master key' },
    { key: 'policyEngine', label: 'Policy Engine', icon: '🛡', note: 'Embedded, fail-closed — clears every navigation' },
    { key: 'attestation', label: 'VEIL Attestation', icon: '🪪', note: 'X-VEIL-Client / X-VEIL-Session on RNK hosts' },
    { key: 'chainRouting', label: 'Ghost Chain Routing', icon: '⛓', note: 'Pentest surface only; off unless VEIL_CHAIN_ROUTING=on' },
    { key: 'heartbeat', label: 'Heartbeat', icon: '♥', note: 'Session liveness' },
];

export function mountProtectsHealth(mountEl) {
    if (!mountEl) return;

    mountEl.innerHTML = `
        <div class="sc-root">
            <div class="sc-header">
                <h2 class="sc-title">P.R.O.T.E.C.T.S. — Organ Health</h2>
                <button class="sc-refresh-btn" id="protects-refresh-btn" title="Refresh status">Refresh</button>
            </div>

            <section class="sc-section">
                <h3 class="sc-section-title">Resolute / C.O.M.M.A.N.D.</h3>
                <div class="sc-cards" id="protects-gate-card"></div>
            </section>

            <section class="sc-section">
                <h3 class="sc-section-title">Organs</h3>
                <div class="sc-cards" id="protects-organ-cards"></div>
            </section>

            <section class="sc-section">
                <h3 class="sc-section-title">Resolute URL</h3>
                <div class="sc-url-row">
                    <input type="text" id="protects-url-input" class="sc-url-input"
                        value="${RESOLUTE_URL()}" placeholder="http://127.0.0.1:7781">
                    <button id="protects-url-save" class="sc-btn">Save</button>
    </div>
                <p class="sc-panel-desc" style="margin-top:.5rem">
                    The handshake URL is configuration, not doctrine. If Resolute is dark, VEIL holds
                    fail-closed: shortcodes are dev/bootstrap only and production sessions come from
                    C.O.M.M.A.N.D.
                </p>
            </section>
        </div>`;

    const wire = () => {
        mountEl.querySelector('#protects-refresh-btn')?.addEventListener('click', refreshAll);
        mountEl.querySelector('#protects-url-save')?.addEventListener('click', () => {
            const val = mountEl.querySelector('#protects-url-input')?.value.trim();
            if (val) {
                localStorage.setItem('veil_resolute_url', val);
                refreshAll();
            }
        });
    };
    wire();
    refreshAll();
}

async function fetchHealth() {
    try {
        const res = await fetch(`${RESOLUTE_URL().replace(/\/$/, '')}/health`, {
            signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
}
}

function badge(ok, label) {
    return `<span class="sc-badge ${ok ? 'sc-badge-ok' : 'sc-badge-off'}">${label}</span>`;
}

function renderHealth(status) {
    const gate = document.getElementById('protects-gate-card');
    const organs = document.getElementById('protects-organ-cards');
    if (!gate || !organs) return;

    const resoluteOk = Boolean(status?.connected);
    gate.innerHTML = `
        <div class="sc-card">
            <div class="sc-card-icon">👑</div>
            <div class="sc-card-body">
                <div class="sc-card-label">C.O.M.M.A.N.D. gate</div>
                <div class="sc-card-state">${badge(
                    resoluteOk,
                    resoluteOk ? 'REACHABLE' : 'HOLD — FAIL CLOSED',
                )}</div>
            </div>
        </div>
        <div class="sc-card">
            <div class="sc-card-icon">📞</div>
            <div class="sc-card-body">
                <div class="sc-card-label">Handshake URL</div>
                <div class="sc-card-state">${RESOLUTE_URL()}</div>
            </div>
        </div>`;

    organs.innerHTML = ORGANS.map((o) => {
        const val = status?.organs?.[o.key];
        const ok = resoluteOk && typeof val === 'string' && !/inactive|unarmed|dark/i.test(val);
        return `
        <div class="sc-card">
            <div class="sc-card-icon">${o.icon}</div>
            <div class="sc-card-body">
                <div class="sc-card-label">${o.label}</div>
                <div class="sc-card-state">${badge(ok, ok ? String(val) : 'UNKNOWN')}</div>
                <div class="sc-panel-desc">${o.note}</div>
            </div>
        </div>`;
    }).join('');
}

async function refreshAll() {
    const status = await fetchHealth();
    renderHealth(status);
}
