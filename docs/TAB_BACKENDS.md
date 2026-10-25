# GENYSYS tab backends

Status: backend boundary introduced; Camofox live noVNC surface is wired behind
an explicit readiness gate; main-frame redirect hops are fail-closed through a
loopback GENYSYS policy callback.

GENYSYS owns the logical tab, policy decision, session, attestation, lifecycle,
history, and chrome. A content backend is an implementation detail of that same
logical tab. The current WebKit surface remains the default.

## Backend selector

`GENYSYS_TAB_BACKEND` accepts:

- `webkit`, `webkitgtk`, or empty: use the existing Tauri WebKit surface.
- `camofox`: use the local Camofox REST service plus its live noVNC display.
  Tab creation refuses unless the service is healthy and `/vnc/status` reports
  an enabled, running `/vnc.html` surface.

Unknown values refuse with `unsupported_tab_backend:<value>`. Camofox does not
silently fall back to WebKit, because that would make the visible browser and
the declared browser backend disagree.

## Required Camofox bridge

The Camofox backend keeps one GENYSYS tab identity while binding a Camofox
session and tab handle to it. Navigation passes GENYSYS policy before the
Camofox request. Each main-frame hop, including HTTP and client-side redirects,
is paused by Camofox and checked against a loopback GENYSYS callback before the
request continues. The navigate response returns the hop chain for audit.
GENYSYS still re-checks the final URL, and the noVNC page is embedded as the
one visible content surface for that logical tab. The current display bridge
supports one visible Camofox tab at a time because the service exposes one
global VNC display.

A missing hop chain after a policy-guarded navigate fails closed with
`camofox_redirect_guard_missing`. Callback timeouts, unreachable callbacks, and
non-loopback callback URLs also refuse. Subresources are not gated by this
boundary.

The backend also exposes bounded, read-only structured capabilities through
`camofox_snapshot` and `camofox_links`, so an agent can inspect the page's
accessibility tree and HTTP links without scraping the visible surface. The
snapshot URL is re-evaluated through the GENYSYS policy before it is accepted.
`camofox_screenshot` is available as a bounded auxiliary artifact; it does not
replace the live surface.

`camofox_status` reports service reachability and noVNC readiness as structured
data, including stable refusal reasons, so the shell or Jess can distinguish a
missing service, a stopped browser, and a missing interactive display.

The shell publishes `window.camofoxBrowser` as the typed local capability
surface for Jess. It routes inspection and interaction through GENYSYS IPC and
never gives the shell direct access to the Camofox loopback service.

The embedded noVNC display is currently view-only. This is intentional: direct
mouse and keyboard events would otherwise navigate the remote browser without
passing through GENYSYS policy.

Click, type, press, scroll, wait, and link extraction are exposed only as typed
GENYSYS IPC commands. They refresh the remote snapshot before or after the
operation and close the remote tab if the reported page becomes blocked or
privileged. Direct noVNC input remains disabled; first-request attestation is
still required for a complete security proof.

Privileged RNK pages remain fail-closed until first-request GENYSYS attestation
can be transferred into Camofox's browser context. A screenshot-only
implementation is not an acceptable bridge.
