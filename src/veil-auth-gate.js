/**
 * VEIL™ — Startup Auth Gate (standalone)
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Auth doctrine (2026-09-06):
 *  1. Production auth = C.O.M.M.A.N.D. session via the Resolute
 *     Authentication Core. The native shell enforces this; shortcodes are
 *     refused in production builds.
 *  2. Local shortcodes are DEV/bootstrap only, labeled as such.
 *  3. Dev bypass only when import.meta.env.DEV && veil_dev_bypass=true.
 *  4. Mother Lisa / biosig / FIDO are stubs (never fake success).
 *  5. If a production build starts without COMMAND_URL/RESOLUTE_URL, the
 *     shell reports a fail-closed HOLD and this gate shows it.
 */

const SESSION_KEY = 'rnk-veil-auth-session';
const DEV_BYPASS_KEY = 'veil_dev_bypass';

const gate = document.getElementById('veil-auth-gate');
const card = document.getElementById('veil-auth-card');
const form = document.getElementById('veil-auth-form');
const input = document.getElementById('veil-auth-input');
const visBtn = document.getElementById('veil-auth-vis-btn');
const errorEl = document.getElementById('veil-auth-error');
const submitBtn = document.getElementById('veil-auth-submit');

function isDevBypassEnabled() {
    try {
        // Use import.meta.env.DEV (no optional chaining) so Vite can replace it.
        if (Boolean(import.meta.env.DEV) && localStorage.getItem(DEV_BYPASS_KEY) === 'true') return true;
        return false;
    } catch {
        return false;
    }
}

function isAlreadyAuthenticated() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return false;
        const { token, expires } = JSON.parse(raw);
        return Boolean(token) && Date.now() < expires;
    } catch {
        return false;
    }
}

function persistSession(authResult) {
    const expires = Date.now() + 8 * 60 * 60 * 1000;
    sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
            token: authResult.token,
            tier: authResult.tier,
            agentId: authResult.agentId,
            expires,
        }),
    );
    // Publish for module code that reads window.veilAuthSession
    // (e.g. section-nav tier gating). Falls back to sessionStorage there.
    window.veilAuthSession = {
        token: authResult.token,
        tier: authResult.tier,
        agentId: authResult.agentId,
        expires,
    };
}

async function tauriInvoke(command, args = {}) {
    if (window.__TAURI__?.invoke) {
        return window.__TAURI__.invoke(command, args);
    }
    throw new Error('VEIL native shell required for authentication');
}

async function resolveCode(code) {
    return tauriInvoke('auth_resolve_code', { code });
}

function dismissGate(authResult) {
    // Mark hidden immediately so late main.js boot does not miss auth.
    gate.classList.add('hidden');
    gate.style.transition = 'opacity 0.4s ease';
    gate.style.opacity = '0';
    gate.setAttribute('aria-hidden', 'true');
    window.__veilAuthenticated = authResult;
    document.dispatchEvent(new CustomEvent('veil:authenticated', { detail: authResult }));
}

function showError(msg) {
    errorEl.textContent = msg;
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true });
    input.value = '';
    input.focus();
}

function clearError() {
    errorEl.textContent = '';
}

async function syncNativeSession(result) {
    try {
        await tauriInvoke('set_session', {
            accessTier: result.tier || 'agent',
            userId: result.agentId || null,
            sessionToken: result.token,
            shortcode: result.shortcode || null,
            deviceVerified: false,
        });
    } catch {
        /* vite-only preview may lack set_session */
    }
}

async function handleCommandExchange() {
    clearError();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Exchanging with Resolute…';
    try {
        // The grant is produced by the C.O.M.M.A.N.D. app (Mother handshake).
        // VEIL forwards it verbatim; B1 judges every layer.
        let grant = null;
        try { grant = JSON.parse(input.value); } catch { grant = null; }
        if (!grant || typeof grant !== 'object') {
            showError('Paste the C.O.M.M.A.N.D. session grant (JSON) minted by the Mother app.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Exchange C.O.M.M.A.N.D. grant';
            return;
        }
        const result = await tauriInvoke('command_exchange', { grant });
        persistSession(result);
        await syncNativeSession(result);
        dismissGate(result);
        startCommandHeartbeat();
    } catch (err) {
        const msg = String(err?.message || err || '');
        showError(
            msg.includes('dark') ? 'Resolute dark — fail closed.' :
            msg.includes('denied') ? 'Handshake denied by Resolute (fail closed).' :
            msg.includes('unreachable') ? 'Resolute unreachable — fail closed.' :
            (err?.message || 'Exchange failed'),
        );
        submitBtn.disabled = false;
        submitBtn.textContent = 'Exchange C.O.M.M.A.N.D. grant';
    }
}

let _heartbeatTimer = null;
function startCommandHeartbeat() {
    if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    _heartbeatTimer = setInterval(async () => {
        try {
            const r = await tauriInvoke('command_heartbeat');
            if (r && r.ok === false && r.phase === 'not-open') {
                // Session dropped (link drop / end) → re-lock the gate.
                clearInterval(_heartbeatTimer);
                _heartbeatTimer = null;
                sessionStorage.removeItem(SESSION_KEY);
            delete window.veilAuthSession;
                delete window.veilAuthSession;
                gate.classList.remove('hidden');
                gate.setAttribute('aria-hidden', 'false');
                showError('C.O.M.M.A.N.D. session dropped — VEIL re-locked.');
            }
        } catch {
            // command_heartbeat errors on link drop (fail closed) — re-lock.
            clearInterval(_heartbeatTimer);
            _heartbeatTimer = null;
            sessionStorage.removeItem(SESSION_KEY);
            delete window.veilAuthSession;
            gate.classList.remove('hidden');
            gate.setAttribute('aria-hidden', 'false');
            showError('Heartbeat link drop — VEIL re-locked (fail closed).');
        }
    }, 5000);
}

async function handleSubmit(e) {
    e.preventDefault();
    const mode = await applyCommandGateState();
    if (mode === 'command') {
        await handleCommandExchange();
        return;
    }
    const code = input.value.trim();
    if (!code) return;

    clearError();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying…';

    try {
        let result;
        if (isDevBypassEnabled()) {
            result = { token: 'dev-bypass', tier: 'dev', agentId: 'local', source: 'dev' };
        } else {
            result = await resolveCode(code);
        }
        persistSession(result);
        await syncNativeSession(result);
        dismissGate(result);
        if (mode === 'command') startCommandHeartbeat();
    } catch (err) {
        showError(err?.message || 'Invalid access code');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Authenticate';
    }
}

function toggleVis() {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    visBtn.textContent = isHidden ? '🙈' : '👁';
}

async function probeLisaHealth() {
    try {
        return await tauriInvoke('check_lisa_health');
    } catch {
        return { connected: true, mode: 'unknown', localPolicy: true };
    }
}

async function applyCommandGateState() {
    // Surface the C.O.M.M.A.N.D. gate honestly: production without a wired
    // handshake is a fail-closed HOLD, and shortcodes do not pretend otherwise.
    try {
        const status = await tauriInvoke('cmd_gate_status');
        if (status?.hold) {
            if (submitBtn) submitBtn.disabled = true;
            if (input) input.disabled = true;
            if (errorEl) {
                errorEl.textContent =
                    'FAIL-CLOSED HOLD — C.O.M.M.A.N.D. / Resolute not configured. ' +
                    'Production VEIL opens only on a C.O.M.M.A.N.D. session.';
            }
            if (submitBtn) submitBtn.textContent = 'Holding';
            return true;
        }
        if (status && status.mode === 'command' && submitBtn) {
            // Resolute wired: gate the exchange behind the owner's C.O.M.M.A.N.D.
            // session on the phone. The grant bundle is minted there; VEIL
            // submits it to B1 for judging (booleans carry no authority).
            submitBtn.textContent = 'Exchange C.O.M.M.A.N.D. grant';
            return 'command';
        }
        if (status && status.mode === 'dev' && submitBtn) {
            submitBtn.textContent = 'Authenticate (dev/bootstrap code)';
        }
    } catch { /* vite-only preview — backend gate still enforced natively */ }
    return false;
}

function setLisaConnectState(health) {
    const subtitle = document.querySelector('.veil-auth-subtitle');
    if (!subtitle || !submitBtn) return;

    const mode = health?.mode || 'local';
    if (health?.localPolicy || mode === 'local' || mode === 'local-fallback') {
        subtitle.textContent = mode === 'remote' && health.connected
            ? 'Lisa ready (local + remote)'
            : 'Lisa ready (local policy)';
        subtitle.classList.add('veil-auth-subtitle--live');
    } else {
        subtitle.textContent = 'Secure Access Required';
    }
    submitBtn.textContent = 'Authenticate';

    // Mother Lisa affordance — stub only
    let mother = document.getElementById('veil-mother-lisa-btn');
    if (!mother && card) {
        mother = document.createElement('button');
        mother.type = 'button';
        mother.id = 'veil-mother-lisa-btn';
        mother.className = 'veil-auth-mother';
        mother.textContent = 'Mother Lisa (not wired)';
        mother.title = 'Biosig / FIDO path ships with Mother Lisa';
        mother.style.cssText = 'margin-top:0.75rem;width:100%;opacity:0.7;font-size:0.8rem;';
        form?.appendChild(mother);
        mother.addEventListener('click', () => {
            showError('Mother Lisa / biosig not wired yet — use an access code');
        });
    }
}

function bindWindowControls() {
    if (window.__veilWindowControlsBound) return;
    window.__veilWindowControlsBound = true;
    const run = (cmd) => {
        if (window.__TAURI__?.invoke) return window.__TAURI__.invoke(cmd);
        if (typeof window.invoke === 'function') return window.invoke(cmd);
        return Promise.resolve();
    };
    const bind = (id, cmd) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            run(cmd);
        });
    };
    bind('minimize-btn', 'window_minimize');
    bind('maximize-btn', 'window_maximize');
    bind('close-btn', 'window_close');
}

async function init() {
    if (!gate) return;
    bindWindowControls();

    if (isDevBypassEnabled()) {
        const result = { token: 'dev-bypass', tier: 'dev', agentId: 'local', source: 'dev' };
        persistSession(result);
        await syncNativeSession(result);
        dismissGate(result);
        return;
    }

    if (isAlreadyAuthenticated()) {
        try {
            const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
            await syncNativeSession({
                token: saved.token,
                tier: saved.tier || 'agent',
                agentId: saved.agentId || 'session',
            });
        } catch { /* ignore */ }
        gate.classList.add('hidden');
        Promise.resolve().then(() => {
            document.dispatchEvent(
                new CustomEvent('veil:authenticated', {
                    detail: JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}'),
                }),
            );
        });
        // Resume the C.O.M.M.A.N.D. heartbeat if a Resolute session is open.
        try {
            const st = await tauriInvoke('command_session_status');
            if (st?.phase === 'open') startCommandHeartbeat();
        } catch { /* no native shell — nothing to resume */ }
        return;
    }

    form?.addEventListener('submit', handleSubmit);
    visBtn?.addEventListener('click', toggleVis);
    input?.addEventListener('input', clearError);

    const holding = await applyCommandGateState();
    if (holding) return;

    const health = await probeLisaHealth();
    setLisaConnectState(health);
    setTimeout(() => input?.focus(), 100);
}

init();
