/**
 * Axis™ — LISA auth panel UI
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Standalone shortcode authentication. All auth resolves through the local
 * Rust command `auth_resolve_code` (AXIS_ACCESS_CODES). No remote auth server.
 */

import { tauriInvoke, getSession, updateLisaStatusIndicator } from '../lisa-bridge.js'

let _authPanelEl = null

export function initAuthPanel() {
  // Create auth overlay if it doesn't exist
  if (document.getElementById('axis-auth-panel')) return

  const panel = document.createElement('div')
  panel.id = 'axis-auth-panel'
  panel.className = 'axis-auth-panel'
  panel.innerHTML = `
    <div class="axis-auth-inner">
      <div class="axis-auth-logo">
        <svg width="40" height="50" viewBox="0 0 160 200" fill="none">
          <path d="M80 10 L140 35 L140 110 Q140 170 80 195 Q20 170 20 110 L20 35 Z" fill="#0f172a" stroke="#b8860b" stroke-width="3"/>
          <rect x="71" y="48" width="18" height="14" rx="2" fill="#b8860b"/>
          <path d="M75 48 L75 42 Q75 34 80 34 Q85 34 85 42 L85 48" fill="none" stroke="#b8860b" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
      <h2 class="axis-auth-title">RNK Axis™</h2>
      <p class="axis-auth-subtitle">Enter your access code to authenticate</p>

      <div class="axis-auth-field">
        <input
          type="password"
          id="axis-shortcode-input"
          class="axis-auth-input"
          placeholder="Access code"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
      </div>

      <div id="axis-auth-error" class="axis-auth-error" style="display:none"></div>

      <button id="axis-auth-submit" class="axis-auth-btn">Authenticate</button>

      <p class="axis-auth-note">
        Restricted access requires an access code issued for your tier.
        Mother Lisa / biosig opens with that product.
      </p>
    </div>
  `
  document.body.appendChild(panel)
  _authPanelEl = panel

  // Bind events
  const input  = panel.querySelector('#axis-shortcode-input')
  const submit = panel.querySelector('#axis-auth-submit')
  const error  = panel.querySelector('#axis-auth-error')

  const attemptAuth = async () => {
    const value = input.value.trim()
    if (!value) return

    error.style.display = 'none'
    submit.disabled = true
    submit.textContent = 'Authenticating...'

    try {
      const result = await authenticateAccessCode(value)
      if (result.success) {
        hideAuthPanel()
        updateLisaStatusIndicator()
      } else {
        error.textContent = result.error ?? 'Authentication failed. Check your access code.'
        error.style.display = 'block'
        input.value = ''
        input.focus()
      }
    } catch {
      error.textContent = 'Authentication error. Axis native shell required.'
      error.style.display = 'block'
    } finally {
      submit.disabled = false
      submit.textContent = 'Authenticate'
    }
  }

  submit.addEventListener('click', attemptAuth)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptAuth()
  })
}

export function showAuthPanel() {
  if (!_authPanelEl) initAuthPanel()
  _authPanelEl.style.display = 'flex'
  setTimeout(() => document.getElementById('axis-shortcode-input')?.focus(), 50)
}

export function hideAuthPanel() {
  if (_authPanelEl) _authPanelEl.style.display = 'none'
}

// ── Access code authentication (local, standalone) ────────────────────────────

async function authenticateAccessCode(code) {
  try {
    const result = await tauriInvoke('auth_resolve_code', { code })
    if (!result?.token) {
      return { success: false, error: 'Invalid access code' }
    }

    await tauriInvoke('set_session', {
      accessTier: result.tier ?? 'agent',
      userId: result.agentId ?? null,
      sessionToken: result.token,
      shortcode: code,
      deviceVerified: false,
    })

    return { success: true, tier: result.tier, agentId: result.agentId }
  } catch (err) {
    return { success: false, error: err?.message ?? 'Invalid access code' }
  }
}

window.initAuthPanel = initAuthPanel
window.showAuthPanel = showAuthPanel
window.hideAuthPanel = hideAuthPanel
