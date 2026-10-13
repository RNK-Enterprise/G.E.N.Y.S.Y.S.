/**
 * GENYSYS™ — Super Admin Ops Plane
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * LISA-gated. Only visible when tier === 'super-admin' or dev bypass.
 * Backend only — NOT deployed to agencies.
 *
 * Standalone: fleet/log sources are not wired yet. Surfaces render locally
 * with an explicit "source not wired" state instead of calling out to any
 * retired GENYSYS endpoints. Every local action is audit-logged.
 */

const AUDIT_KEY = 'genysys-admin-audit';

// ── Audit trail ───────────────────────────────────────────────────────

function audit(action, detail = '') {
    const log = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
    log.push({ ts: new Date().toISOString(), action, detail });
    if (log.length > 500) log.splice(0, log.length - 500);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(log));
}

function loadAuditLog() {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
}

// ── Log DB fetch (sources not wired in standalone GENYSYS) ──────────────

async function fetchLogs(_source, _tail = 50) {
    return [];
}

async function fetchFleetStatus() {
    return null;
}

// ── UI ────────────────────────────────────────────────────────────────

function renderLogEntries(entries) {
    if (!entries.length) return '<div class="ops-log-empty">Log source not wired yet</div>';
    return entries.map(e => `
        <div class="ops-log-entry">
            <span class="ops-log-ts">${e.ts || e.timestamp || ''}</span>
            <span class="ops-log-msg">${escapeHtml(e.message || JSON.stringify(e))}</span>
        </div>
    `).join('');
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function refreshLogs(source, container) {
    container.innerHTML = '<div class="ops-log-loading">Loading…</div>';
    audit('log_fetch', source);
    const entries = await fetchLogs(source);
    container.innerHTML = renderLogEntries(entries);
}

async function refreshFleet(container) {
    container.innerHTML = '<div class="ops-log-loading">Loading fleet status…</div>';
    audit('fleet_status_fetch');
    const status = await fetchFleetStatus();
    if (!status) {
        container.innerHTML = '<div class="ops-log-empty">Fleet source not wired yet</div>';
        return;
    }
    const nodes = Array.isArray(status.nodes) ? status.nodes : [];
    container.innerHTML = nodes.length
        ? nodes.map(n => `
            <div class="ops-fleet-node ops-fleet-node--${n.status || 'unknown'}">
                <span class="ops-fleet-node-name">${escapeHtml(n.name || n.id || 'node')}</span>
                <span class="ops-fleet-node-status">${escapeHtml(n.status || 'unknown')}</span>
                <span class="ops-fleet-node-uptime">${escapeHtml(n.uptime || '')}</span>
            </div>
        `).join('')
        : '<div class="ops-log-empty">No nodes returned</div>';
}

// ── Mount ─────────────────────────────────────────────────────────────

export function mountAdminOps(mountEl, authTier) {
    if (!mountEl) return;

    if (authTier !== 'super-admin' && authTier !== 'dev') {
        mountEl.innerHTML = `
            <div class="genysys-section-placeholder">
                <span class="genysys-section-icon">🔐</span>
                <h2>Admin</h2>
                <p>Audit · Settings · Admin Panel</p>
                <p class="genysys-section-coming-soon">Lisa authorization required</p>
            </div>
        `;
        return;
    }

    mountEl.innerHTML = `
        <div class="ops-plane">
            <div class="ops-plane-header">
                <span class="ops-plane-title">Ops Plane</span>
                <span class="ops-plane-tier">${escapeHtml(authTier)}</span>
            </div>

            <div class="ops-tabs">
                <button class="ops-tab active" data-tab="chain">Chain Logs</button>
                <button class="ops-tab" data-tab="lisa">LISA Logs</button>
                <button class="ops-tab" data-tab="genysys">GENYSYS Logs</button>
                <button class="ops-tab" data-tab="fleet">Fleet</button>
                <button class="ops-tab" data-tab="audit">Audit Trail</button>
            </div>

            <div class="ops-panels">
                <div class="ops-panel active" id="ops-panel-chain">
                    <div class="ops-panel-toolbar">
                        <button class="ops-refresh-btn" data-source="chain">Refresh</button>
                    </div>
                    <div class="ops-log-feed" id="ops-feed-chain"></div>
                </div>
                <div class="ops-panel" id="ops-panel-lisa">
                    <div class="ops-panel-toolbar">
                        <button class="ops-refresh-btn" data-source="lisa">Refresh</button>
                    </div>
                    <div class="ops-log-feed" id="ops-feed-lisa"></div>
                </div>
                <div class="ops-panel" id="ops-panel-genysys">
                    <div class="ops-panel-toolbar">
                        <button class="ops-refresh-btn" data-source="genysys">Refresh</button>
                    </div>
                    <div class="ops-log-feed" id="ops-feed-genysys"></div>
                </div>
                <div class="ops-panel" id="ops-panel-fleet">
                    <div class="ops-panel-toolbar">
                        <button class="ops-refresh-btn" data-source="fleet">Refresh</button>
                    </div>
                    <div class="ops-log-feed" id="ops-feed-fleet"></div>
                </div>
                <div class="ops-panel" id="ops-panel-audit">
                    <div class="ops-log-feed" id="ops-feed-audit"></div>
                </div>
            </div>
        </div>
    `;

    // Tab switching
    mountEl.querySelectorAll('.ops-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            mountEl.querySelectorAll('.ops-tab').forEach(t => t.classList.remove('active'));
            mountEl.querySelectorAll('.ops-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            mountEl.querySelector(`#ops-panel-${tab.dataset.tab}`).classList.add('active');
            audit('tab_switch', tab.dataset.tab);

            if (tab.dataset.tab === 'audit') {
                const feed = mountEl.querySelector('#ops-feed-audit');
                const log = loadAuditLog().reverse();
                feed.innerHTML = log.length
                    ? log.map(e => `<div class="ops-log-entry"><span class="ops-log-ts">${e.ts}</span><span class="ops-log-msg">${escapeHtml(e.action)}${e.detail ? ` — ${escapeHtml(e.detail)}` : ''}</span></div>`).join('')
                    : '<div class="ops-log-empty">No audit entries yet</div>';
            }
        });
    });

    // Refresh buttons
    mountEl.querySelectorAll('.ops-refresh-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const source = btn.dataset.source;
            if (source === 'fleet') {
                refreshFleet(mountEl.querySelector('#ops-feed-fleet'));
            } else {
                refreshLogs(source, mountEl.querySelector(`#ops-feed-${source}`));
            }
        });
    });

    // Auto-load chain logs on mount
    refreshLogs('chain', mountEl.querySelector('#ops-feed-chain'));
}
