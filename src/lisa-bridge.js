import { initAuthPanel, showAuthPanel, hideAuthPanel } from './lisa/lisa-bridge-auth-ui.js';

/**
 * RNK GENYSYS™ — LISA Bridge
 *
 * Intercepts all navigation in the frontend and routes through the Rust
 * navigate_tab command, which enforces LISA policy before allowing any
 * page to load.
 *
 * Every navigation is LISA-gated. No exceptions.
 *
 * Decision handling:
 *   allow     → iframe loads normally
 *   flag      → iframe loads, subtle indicator shown in status bar
 *   quarantine → iframe does not load, quarantine notice shown
 *   block     → iframe does not load, block page shown
 *   chain     → NOT loadable in GENYSYS. Ghost chain routing is not wired in the
 *               shell; policy fail-closes chain requests. GENYSYS never loads a
 *               "chained" URL directly — that would leak the request.
 *
 * Also handles:
 *   - Session management (shortcode auth, set_session Tauri command)
 *   - Access request flow (unlisted domains for restricted tiers)
 *   - LISA status indicator in titlebar
 *
 * Creator: Barry "Odinn" Walter, RNK Enterprise
 */

// ── Tauri IPC bridge ──────────────────────────────────────────────────────────
// window.__TAURI__ is injected by Tauri when withGlobalTauri: true in tauri.conf.json

// Window bridge — modules extracted from the original main.js reference these
// globals directly (tab-manager.js, tab-manager-extras.js). Publish them here so
// navigation always routes through the LISA gate.
window.normalizeUrl = normalizeUrl;
window.navigateWithLISA = navigateWithLISA;
window.tauriInvoke = tauriInvoke;

export function tauriInvoke(command, args = {}) {
  if (window.__TAURI__?.invoke) {
    return window.__TAURI__.invoke(command, args)
  }
  // Dev fallback when running in browser without Tauri
  console.warn(`[LISA Bridge] Tauri not available — dev mode passthrough for ${command}`)
  return Promise.resolve(_devFallback(command, args))
}

function tauriListen(event, handler) {
  if (window.__TAURI__?.event?.listen) {
    return window.__TAURI__.event.listen(event, handler)
  }
  return Promise.resolve(() => {}) // no-op unlisten in dev mode
}

function isDevBypassEnabled() {
  try {
    // No optional chaining — Vite must see import.meta.env.DEV to replace it.
    return Boolean(import.meta.env.DEV)
      && localStorage.getItem('genysys_dev_bypass') === 'true'
  } catch {
    return false
  }
}

function _devFallback(command, args) {
  // Browser-only (no Tauri). Fail-closed unless explicit dev bypass.
  const bypass = isDevBypassEnabled()
  switch (command) {
    case 'navigate_tab': {
      const url = args?.url ?? ''
      const internal = /^(genysys|about|data|blob):/i.test(url)
      if (bypass || internal) {
        return {
          decision: 'allow',
          reason: bypass ? 'dev_bypass_allow' : 'internal_genysys_surface',
          audit: true,
          notify: false,
          chain: false,
          domain: url,
          source: 'local',
        }
      }
      return {
        decision: 'block',
        reason: 'lisa_unreachable_fail_closed',
        audit: true,
        notify: true,
        chain: false,
        domain: url,
        source: 'local',
      }
    }
    case 'create_tab':
      return {
        id: Date.now(),
        url: args.url ?? 'genysys://newtab',
        title: 'New Tab',
        context: 'normal',
        loading: false,
        can_go_back: false,
        can_go_fwd: false,
      }
    case 'set_session':
      return null
    case 'get_session_info':
    case 'auth_session_info':
      return { accessTier: 'locked', shortcode: null, deviceVerified: false, authenticated: false }
    case 'auth_resolve_code':
      if (!bypass) return Promise.reject(new Error('Auth requires GENYSYS native shell'))
      return { token: 'dev-bypass', tier: 'dev', agentId: 'local', source: 'dev' }
    case 'check_lisa_health':
    case 'check_genysys_health':
      return { connected: true, mode: 'local', localPolicy: true, lisaUrl: '' }
    case 'request_site_access':
      return { submitted: true, requestId: 'dev-' + Date.now() }
    default:
      return null
  }
}

// ── Session state ─────────────────────────────────────────────────────────────

let _session = {
  accessTier:    'locked',
  shortcode:     null,
  deviceVerified: false,
  authenticated: false,
}

export async function refreshSession() {
  try {
    _session = await tauriInvoke('get_session_info')
    updateLisaStatusIndicator()
  } catch { /* non-fatal */ }
}

export function getSession() {
  return { ..._session }
}

export async function setSession(sessionData) {
  try {
    await tauriInvoke('set_session', sessionData)
    _session = await tauriInvoke('get_session_info')
    updateLisaStatusIndicator()
  } catch (err) {
    console.error('[LISA Bridge] set_session failed:', err)
  }
}

export async function clearSession() {
  try {
    await tauriInvoke('clear_session')
    _session = { accessTier: 'locked', shortcode: null, deviceVerified: false, authenticated: false }
    updateLisaStatusIndicator()
    showAuthPanel()
  } catch { /* non-fatal */ }
}

// ── LISA status indicator ─────────────────────────────────────────────────────

export function updateLisaStatusIndicator() {
  const el = document.getElementById('lisa-status-indicator')
  if (!el) return

  const tier = _session.accessTier ?? 'unknown'
  const auth = _session.authenticated

  el.textContent = auth ? `LISA: ${tier}` : 'LISA: unauthenticated'
  el.className = `lisa-status-indicator lisa-status-${auth ? 'active' : 'inactive'}`
}

// ── Core navigation gate ──────────────────────────────────────────────────────

/**
 * Navigate a tab through the LISA policy gate.
 * This is the ONLY path through which any URL may load.
 *
 * @param {number} tabId
 * @param {string} url
 * @param {Function} onAllow   — called with (url, chain) when LISA allows navigation
 * @param {Function} onBlock   — called with (policy) when LISA blocks navigation
 * @returns {Promise<object>}  — the PolicyResult
 */
export async function navigateWithLISA(tabId, url, onAllow, onBlock) {
  // Normalize URL
  const normalized = normalizeUrl(url)

  // Show loading state immediately
  setTabLoading(tabId, true)

  let policy
  try {
    policy = await tauriInvoke('navigate_tab', { tabId, url: normalized })
  } catch (err) {
    // Fail-closed: Lisa / Tauri unreachable → block
    console.warn('[LISA Bridge] navigate_tab failed (fail-closed):', err)
    policy = {
      decision: 'block',
      reason: 'lisa_unreachable_fail_closed',
      audit: true,
      notify: true,
      chain: false,
      domain: normalized,
      source: 'local',
    }
  }

  if (!policy || typeof policy !== 'object') {
    policy = {
      decision: 'block',
      reason: 'missing_policy_fail_closed',
      audit: true,
      notify: true,
      chain: false,
      domain: normalized,
      source: 'local',
    }
  }

  const decision = policy.decision ?? 'block'

  switch (decision) {
    case 'allow':
      onAllow?.(normalized, false)
      window.dispatchEvent(new CustomEvent('genysys:policy-allow', { detail: { url: normalized, chain: false } }))
      break

    case 'flag':
      onAllow?.(normalized, false)
      window.dispatchEvent(new CustomEvent('genysys:policy-allow', { detail: { url: normalized, chain: false } }))
      showLisaFlag(policy)
      break

    case 'chain':
      // Ghost chain routing is not wired in the GENYSYS shell. Loading the URL
      // directly would silently bypass the chain — fail closed instead.
      setTabLoading(tabId, false)
      onBlock?.(policy)
      break

    case 'quarantine':
      setTabLoading(tabId, false)
      policy.quarantined = true
      onBlock?.(policy)
      break

    case 'block':
      setTabLoading(tabId, false)
      onBlock?.(policy)
      break

    default:
      // Unknown decision → fail-closed
      setTabLoading(tabId, false)
      onBlock?.(policy)
  }

  return policy
}

// ── Tauri event listener: genysys:navigate ───────────────────────────────────────
// Rust emits this after LISA approves — frontend should drive the WebView here

let _navigateHandler = null

export function onGENYSYSNavigate(handler) {
  _navigateHandler = handler
  return tauriListen('genysys:navigate', (event) => {
    handler?.(event.payload)
  })
}

// ── LISA decision UI ──────────────────────────────────────────────────────────

function setTabLoading(tabId, loading) {
  // Signal to the main TabManager via custom event
  window.dispatchEvent(new CustomEvent('genysys:tab-loading', { detail: { tabId, loading } }))
}

function showLisaFlag(policy) {
  const status = document.getElementById('status-text')
  if (status) {
    status.textContent = `⚑ LISA flagged: ${policy.reason ?? 'low confidence signal'}`
    status.classList.add('status-flagged')
    setTimeout(() => {
      status.classList.remove('status-flagged')
      status.textContent = 'Ready'
    }, 5000)
  }
}

// ── Access request submission ─────────────────────────────────────────────────

export async function submitAccessRequest(domain, reason) {
  try {
    const result = await tauriInvoke('request_site_access', { domain, reason })
    return result
  } catch (err) {
    console.error('[LISA Bridge] access request failed:', err)
    throw err
  }
}

// ── URL normalization ─────────────────────────────────────────────────────────

export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') return 'genysys://newtab'
  const trimmed = input.trim()
  if (!trimmed) return 'genysys://newtab'

  // Already a full URL
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^genysys:\/\//i.test(trimmed)) return trimmed

  // Looks like a domain (has dot, no spaces)
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed) && !trimmed.includes(' ')) {
    return `https://${trimmed}`
  }

  // Otherwise treat as a search query
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`
}

// ── Message listener for iframe postMessages ──────────────────────────────────
// Quarantine "proceed anyway" and access request forms post messages to parent

export function initMessageListener(tabManager) {
  window.addEventListener('message', async (event) => {
    const { type, domain, reason } = event.data ?? {}

    if (type === 'genysys:access-request') {
      try {
        await submitAccessRequest(domain, reason)
      } catch { /* submission errors shown in iframe */ }
    }

    if (type === 'genysys:proceed-anyway') {
      // User explicitly overrode quarantine — load with audit flag
      console.warn(`[LISA Bridge] User overrode quarantine for ${domain}`)
      tabManager?.navigateActiveTab(domain)
    }
  })
}

// ── Initialization ────────────────────────────────────────────────────────────

export async function initLISABridge(tabManager) {
  // Load initial session
  await refreshSession()

  // Init message bridge for iframe postMessages
  initMessageListener(tabManager)

  // Listen for Tauri genysys:navigate events (Rust fires these after policy
  // approval AND after creating the tab window).
  onGENYSYSNavigate((payload) => {
    const { tabId, url, context, chain } = payload || {}
    tabManager?.onTauriNavigate?.(tabId, url, context, chain)
  })

  // Tab-window metadata (title/URL) mirrored from Rust — the single source
  // of truth for what a tab actually shows.
  tauriListen('genysys:tab-meta', (event) => {
    tabManager?.onTabMeta?.(event.payload?.tabId, event.payload || {})
  })

  // Listen for tab loading state changes from navigate calls
  window.addEventListener('genysys:tab-loading', (e) => {
    const { tabId, loading } = e.detail
    tabManager?.setTabLoading?.(tabId, loading)
  })

  // Window-mode geometry: keep the tab window glued to the content area on
  // shell resizes (main-window moves are handled natively).
  window.addEventListener('resize', () => {
    tabManager?.syncContentRect?.(tabManager.activeTabId)
  })

  // Section-nav hook: hide tab windows outside the Browser section.
  window.tabWindowBridge = {
    onSectionLeave() {
      tauriInvoke('tab_window_hide_all').catch(() => {})
    },
    onSectionEnter() {
      const active = tabManager?.activeTabId
      if (active != null) tauriInvoke('tab_window_activate', { tabId: active }).catch(() => {})
      tabManager?.syncContentRect?.(active)
    },
  }

  // Add LISA status indicator to titlebar
  injectLisaStatusIndicator()

  // GENYSYS engine runtime owns the status indicator; nothing external to poll.
  console.log('[LISA Bridge] Initialized')
}

function injectLisaStatusIndicator() {
  const titlebarRight = document.querySelector('.titlebar-right')
  if (!titlebarRight) return

  const indicator = document.createElement('span')
  indicator.id = 'lisa-status-indicator'
  indicator.className = 'lisa-status-indicator lisa-status-inactive'
  indicator.textContent = 'LISA: initializing'
  indicator.style.cssText = 'font-size:10px; padding: 2px 8px; border-radius: 3px; margin-right: 8px; cursor: pointer; transition: all .2s;'
  indicator.title = 'Click to authenticate'
  indicator.addEventListener('click', () => {
    if (!_session.authenticated) showAuthPanel()
  })    // Insert before minimize button
    const minimizeBtn = titlebarRight.querySelector('#minimize-btn')
    titlebarRight.insertBefore(indicator, minimizeBtn)

    // Session may already be resolved (refreshSession ran before injection) —
    // sync immediately instead of showing "initializing" until the next poll.
    updateLisaStatusIndicator()
}
