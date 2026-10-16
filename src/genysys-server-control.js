/**
 * GENYSYS™ — Server Control Tab
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Creator-only section. Talks to the Resolute Authentication Core
 * (C.O.M.M.A.N.D. master key) — NOT to a Brain/Lisa :7700 as the mind.
 * Surfaces: Resolute/authority status, Test Mode toggle, session gate state.
 *
 * Test Mode: issues a session-bound HMAC-signed token to the authority
 * daemon for benchmarks/tests. Token is max 4h, auto-expires, audit-logged.
 * Toggling off immediately revokes the token — no grace period.
 */

const AUTHORITY_URL = () =>
    localStorage.getItem('genysys_resolute_url') || 'http://127.0.0.1:7781';
const SESSION_KEY = 'genysys-server-control-session';

// ── Session ID (stable per browser session) ───────────────────────────

function getSessionId() {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
        sid = 'sc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
        sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
}

// ── LISA authority calls ──────────────────────────────────────────────

async function fetchLayer1Status() {
    try {
        const res = await fetch(`${AUTHORITY_URL()}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

async function issueTestMode(scope = ['benchmark']) {
    try {
        const res = await fetch(`${AUTHORITY_URL()}/api/test-mode/issue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: getSessionId(), scope, ttlMs: 4 * 60 * 60 * 1000 }),
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
        return res.json();
    } catch (e) {
        return { ok: false, reason: e.message };
    }
}

async function revokeTestMode() {
    try {
        const res = await fetch(`${AUTHORITY_URL()}/api/test-mode/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: getSessionId() }),
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
        return res.json();
    } catch (e) {
        return { ok: false, reason: e.message };
    }
}

// ── State ─────────────────────────────────────────────────────────────

let _testModeActive = false;
let _testModeExpiresAt = null;
let _testModeToken = null;
let _refreshTimer = null;
let _expiryTimer = null;

// ── UI helpers ────────────────────────────────────────────────────────

function statusBadge(ok, label) {
    const cls = ok ? 'sc-badge-ok' : 'sc-badge-off';
    return `<span class="sc-badge ${cls}">${label}</span>`;
}

function formatExpiry(ts) {
    if (!ts) return '';
    const diff = Math.max(0, ts - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
}

// ── Render ────────────────────────────────────────────────────────────

function renderLayer1Cards(status) {
    if (!status) {
        return `<div class="sc-status-error">Resolute / authority unreachable — check ${AUTHORITY_URL()}</div>`;
    }

    const components = [
        { key: 'nukeEngine',    label: 'NukeEngine',     icon: 'NE' },
        { key: 'oceanListener', label: 'OceanListener',  icon: 'OL' },
        { key: 'biosigAuth',    label: 'BiosigAuth',     icon: 'BA' },
        { key: 'jumpDrive',     label: 'JumpDrive',      icon: 'JD' },
        { key: 'heartbeat',     label: 'Heartbeat',      icon: 'HB' },
        { key: 'miabListener',  label: 'MIAB Listener',  icon: 'ML' },
        { key: 'miabIssuer',    label: 'MIAB Issuer',    icon: 'MI' },
        { key: 'miabValidator', label: 'MIAB Validator', icon: 'MV' },
        { key: 'testMode',      label: 'Test Mode Mgr',  icon: 'TM' },
    ];

    return components.map(c => {
        const val = status[c.key] || 'INACTIVE';
        const ok = val !== 'INACTIVE' && val !== 'UNARMED';
        return `
        <div class="sc-card">
            <div class="sc-card-icon">${c.icon}</div>
            <div class="sc-card-body">
                <div class="sc-card-label">${c.label}</div>
                <div class="sc-card-state">${statusBadge(ok, val)}</div>
            </div>
        </div>`;
    }).join('');
}

function renderTestModePanel() {
    const active = _testModeActive;
    const expiry = active ? `<div class="sc-tm-expiry" id="sc-tm-expiry">Expires in: ${formatExpiry(_testModeExpiresAt)}</div>` : '';
    const tokenLine = active && _testModeToken
        ? `<div class="sc-tm-token">Token: <code>${_testModeToken.slice(0, 8)}…</code></div>`
        : '';

    return `
    <div class="sc-panel sc-tm-panel ${active ? 'sc-tm-active' : ''}">
        <div class="sc-panel-header">
            <div class="sc-panel-title">Test Mode</div>
            <div class="sc-panel-desc">
                Passes your traffic through the full 21-point gauntlet without interference.
                Every request is audit-logged as TEST_MODE. NukeEngine, biosig, and drive
                verification stay fully active. Max 4-hour session.
            </div>
        </div>
        <div class="sc-tm-controls">
            <label class="sc-toggle-wrap" for="sc-tm-toggle">
                <input type="checkbox" id="sc-tm-toggle" class="sc-toggle-input" ${active ? 'checked' : ''}>
                <span class="sc-toggle-track">
                    <span class="sc-toggle-thumb"></span>
                </span>
                <span class="sc-toggle-label">${active ? 'Active' : 'Inactive'}</span>
            </label>
            ${expiry}
            ${tokenLine}
            <div class="sc-tm-status" id="sc-tm-status"></div>
        </div>
        <div class="sc-tm-scope">
            <span class="sc-scope-label">Scope:</span>
            <label class="sc-scope-check"><input type="checkbox" value="benchmark" ${active ? 'disabled' : ''} checked> Benchmark</label>
            <label class="sc-scope-check"><input type="checkbox" value="mesh-test" ${active ? 'disabled' : ''}> Mesh Test</label>
            <label class="sc-scope-check"><input type="checkbox" value="lisa-eval" ${active ? 'disabled' : ''}> LISA Eval</label>
        </div>
    </div>`;
}

function getSelectedScope(mount) {
    const checks = mount.querySelectorAll('.sc-tm-scope input[type=checkbox]:checked');
    return Array.from(checks).map(c => c.value);
}

// ── Main mount ────────────────────────────────────────────────────────

export async function mountServerControl(mountId = 'server-control-mount') {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    mount.innerHTML = `
    <div class="sc-root">
        <div class="sc-header">
            <h2 class="sc-title">Server Control</h2>
            <button class="sc-refresh-btn" id="sc-refresh-btn" title="Refresh status">Refresh</button>
        </div>

        <section class="sc-section">
            <h3 class="sc-section-title">Resolute / P.R.O.T.E.C.T.S. Status</h3>
            <div class="sc-cards" id="sc-layer1-cards">
                <div class="sc-loading">Connecting to Resolute…</div>
            </div>
        </section>

        <section class="sc-section">
            <h3 class="sc-section-title">Test Mode</h3>
            <div id="sc-tm-container"></div>
        </section>

        <section class="sc-section">
            <h3 class="sc-section-title">Authority URL</h3>
            <div class="sc-url-row">
                <input type="text" id="sc-lisa-url" class="sc-url-input"
                    value="${AUTHORITY_URL()}" placeholder="http://127.0.0.1:7781">
                <button id="sc-lisa-url-save" class="sc-btn">Save</button>
            </div>
        </section>
    </div>`;

    await refreshAll(mount);

    // Wire refresh button
    mount.querySelector('#sc-refresh-btn').addEventListener('click', () => refreshAll(mount));

    // Wire authority URL save
    mount.querySelector('#sc-lisa-url-save').addEventListener('click', () => {
        const val = mount.querySelector('#sc-lisa-url').value.trim();
        if (val) {
            localStorage.setItem('genysys_resolute_url', val);
            refreshAll(mount);
        }
    });

    // Wire test mode toggle (delegated — re-rendered on state change)
    mount.addEventListener('change', async e => {
        if (e.target.id === 'sc-tm-toggle') {
            await handleTestModeToggle(mount, e.target.checked);
        }
    });

    // Auto-refresh status every 30s
    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = setInterval(() => refreshLayer1(mount), 30_000);

    // Expiry countdown every second when active
    startExpiryTick(mount);
}

async function refreshAll(mount) {
    await refreshLayer1(mount);
    renderTestModeContainer(mount);
}

async function refreshLayer1(mount) {
    const cards = mount.querySelector('#sc-layer1-cards');
    if (!cards) return;
    const status = await fetchLayer1Status();
    cards.innerHTML = renderLayer1Cards(status);
}

function renderTestModeContainer(mount) {
    const container = mount.querySelector('#sc-tm-container');
    if (container) container.innerHTML = renderTestModePanel();
}

async function handleTestModeToggle(mount, on) {
    const statusEl = mount.querySelector('#sc-tm-status');
    if (statusEl) statusEl.textContent = on ? 'Issuing token…' : 'Revoking…';

    if (on) {
        const scope = getSelectedScope(mount);
        const result = await issueTestMode(scope.length ? scope : ['benchmark']);
        if (result.ok) {
            _testModeActive = true;
            _testModeExpiresAt = result.expiresAt;
            _testModeToken = result.tokenId;
            renderTestModeContainer(mount);
            startExpiryTick(mount);
        } else {
            renderTestModeContainer(mount);
            const s = mount.querySelector('#sc-tm-status');
            if (s) s.textContent = `Failed: ${result.reason}`;
            // Revert toggle
            const toggle = mount.querySelector('#sc-tm-toggle');
            if (toggle) toggle.checked = false;
        }
    } else {
        await revokeTestMode();
        _testModeActive = false;
        _testModeExpiresAt = null;
        _testModeToken = null;
        if (_expiryTimer) clearInterval(_expiryTimer);
        renderTestModeContainer(mount);
    }
}

function startExpiryTick(mount) {
    if (_expiryTimer) clearInterval(_expiryTimer);
    if (!_testModeActive) return;

    _expiryTimer = setInterval(() => {
        if (!_testModeActive) { clearInterval(_expiryTimer); return; }
        if (_testModeExpiresAt && Date.now() > _testModeExpiresAt) {
            // Token expired — reset state
            _testModeActive = false;
            _testModeExpiresAt = null;
            _testModeToken = null;
            clearInterval(_expiryTimer);
            const mount = document.getElementById('server-control-mount');
            if (mount) renderTestModeContainer(mount);
            return;
        }
        const el = document.getElementById('sc-tm-expiry');
        if (el) el.textContent = `Expires in: ${formatExpiry(_testModeExpiresAt)}`;
    }, 1000);
}

export function unmountServerControl() {
    if (_refreshTimer) clearInterval(_refreshTimer);
    if (_expiryTimer) clearInterval(_expiryTimer);
}
