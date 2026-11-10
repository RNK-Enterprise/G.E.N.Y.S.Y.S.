#!/usr/bin/env node
/**
 * HTTPS probe for the native-cookie live proof.
 *
 * The Tauri proof window writes the cookie through the platform webview, then
 * visits this server. The server records four observable facts:
 *   1. the first request to /first carries genysys_attest;
 *   2. document.cookie cannot see it (HttpOnly);
 *   3. a cross-site POST from 127.0.0.1 to localhost still carries it
 *      (SameSite=None + Secure);
 *   4. /first-done invokes the real Tauri attestation_cookie_clear command,
 *      and /after carries no cookie after it clears.
 *
 * With GENYSYS_COOKIE_PROOF_SAMESITE=lax the third fact is expected to be
 * false; the report records that expectation and still fails if any of the
 * other facts regress.
 *
 * It never touches the RNK production cookie because the proof uses the
 * loopback domain and a random token.
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const tmp = process.argv[2];
if (!tmp) {
  console.error('usage: native-cookie-live-proof-server.mjs <temp-dir>');
  process.exit(2);
}
const cert = fs.readFileSync(path.join(tmp, 'cert.pem'));
const key = fs.readFileSync(path.join(tmp, 'key.pem'));
const token = process.env.GENYSYS_COOKIE_PROOF_TOKEN;
if (!token) {
  console.error('GENYSYS_COOKIE_PROOF_TOKEN is required');
  process.exit(2);
}
const sameSite = (process.env.GENYSYS_COOKIE_PROOF_SAMESITE || 'none').toLowerCase();
if (sameSite !== 'none' && sameSite !== 'lax') {
  console.error(`invalid GENYSYS_COOKIE_PROOF_SAMESITE: ${sameSite}`);
  process.exit(2);
}
const negative = sameSite === 'lax';

const state = {
  first: { cookie: false, visible: null },
  cross: { cookie: false },
  after: { cookie: false, visible: null },
  logout: { status: null, error: null },
};
let finished = false;
let bootServer; // Plain HTTP only to give Linux a certificate-free first page.

const cookieHasToken = (header) =>
  typeof header === 'string' && header.split(';').some((part) => part.trim() === `genysys_attest=${token}`);

function page(body) {
  return `<!doctype html><meta charset="utf-8"><body>${body}</body>`;
}

function finish(server, code = 0) {
  if (finished) return;
  finished = true;
  const checks = {
    first_request_has_cookie: state.first.cookie,
    http_only_hidden_from_javascript: state.first.visible === 'false',
    samesite_none_sent_cross_site: state.cross.cookie,
    logout_command_completed: state.logout.status === 'ok',
    logout_request_without_cookie: !state.after.cookie,
    logout_hidden_from_javascript: state.after.visible === 'false',
  };
  // The negative mode is deliberately expected to omit the cross-site cookie;
  // every other property must still hold, so a failed cookie write cannot
  // masquerade as a passing negative test.
  const expected = { samesite_none_sent_cross_site: !negative };
  const pass =
    code === 0 &&
    checks.first_request_has_cookie &&
    checks.http_only_hidden_from_javascript &&
    checks.samesite_none_sent_cross_site === expected.samesite_none_sent_cross_site &&
    checks.logout_command_completed &&
    checks.logout_request_without_cookie &&
    checks.logout_hidden_from_javascript;
  const report = {
    mode: negative ? 'lax-negative' : 'none-positive',
    pass,
    expected,
    checks,
    state,
  };
  fs.writeFileSync(path.join(tmp, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const exitCode = pass ? 0 : 1;
  server.close();
  bootServer?.close();
  // Keep this timer referenced: closing both servers releases the event loop,
  // and an unref'd timer lets Node exit 0 even when the report failed.
  setTimeout(() => process.exit(exitCode), 500);
}

const server = https.createServer({ key, cert }, (req, res) => {
  const url = new URL(req.url, 'https://127.0.0.1');
  const port = server.address().port;
  const local = `https://localhost:${port}`;
  const crossSite = `https://127.0.0.1:${port}`;

  if (url.pathname === '/blank') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page('proof blank'));
    return;
  }

  if (url.pathname === '/domain') {
    // The Rust proof drives this path directly: it seeds a cookie for the
    // production domain, invokes the production clear command, and reads the
    // real jar back. No page script or DNS entry for the cookie domain is used.
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page('proof production domain'));
    return;
  }

  if (url.pathname === '/first') {
    state.first.cookie = cookieHasToken(req.headers.cookie);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      page(`<script>
const visible = document.cookie.split(';').some((part) => part.trim().startsWith('genysys_attest='));
fetch('/report?step=first&visible=' + visible).catch(() => {});
setTimeout(() => { location.href = '${crossSite}/cross-site'; }, 700);
</script>`),
    );
    return;
  }

  if (url.pathname === '/cross-site') {
    // A cross-site top-level POST, not a third-party subresource: SameSite=None
    // must send the cookie, while Lax/Strict must not.
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      page(`<form id="probe" method="POST" action="${local}/beacon"></form>
<script>document.getElementById('probe').submit();</script>`),
    );
    return;
  }

  if (url.pathname === '/beacon') {
    state.cross.cookie = cookieHasToken(req.headers.cookie);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      page(`<script>setTimeout(() => { location.href = '${local}/first-done'; }, 400);</script>`),
    );
    return;
  }

  if (url.pathname === '/first-done') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    // Invoke the real Tauri logout command over IPC. If IPC is unavailable or
    // the command rejects, still continue to /after so the server can report
    // the surviving cookie rather than hanging until the watchdog.
    res.end(
      page(`<script>
const next = () => setTimeout(() => { location.href = '${local}/after'; }, 900);
const mark = (status, error) => fetch(
  '/report?step=logout&status=' + encodeURIComponent(status) +
  '&error=' + encodeURIComponent(error || '')
).catch(() => {});
const finish = (status, error) => { mark(status, error).finally(next); };
let tries = 0;
function invokeLogout() {
  if (window.__TAURI__ && window.__TAURI__.invoke) {
    Promise.race([
      window.__TAURI__.invoke('attestation_cookie_clear'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]).then(() => finish('ok'), (error) => finish('error', String(error)));
    return;
  }
  if (tries++ < 40) setTimeout(invokeLogout, 50);
  else finish('no-ipc');
}
invokeLogout();
</script>`),
    );
    return;
  }

  if (url.pathname === '/after') {
    state.after.cookie = cookieHasToken(req.headers.cookie);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      page(`<script>
const visible = document.cookie.split(';').some((part) => part.trim().startsWith('genysys_attest='));
fetch('/report?step=after&visible=' + visible).catch(() => {});
</script>`),
    );
    return;
  }

  if (url.pathname === '/report') {
    const visible = url.searchParams.get('visible');
    if (url.searchParams.get('step') === 'first') state.first.visible = visible;
    if (url.searchParams.get('step') === 'after') state.after.visible = visible;
    if (url.searchParams.get('step') === 'logout') {
      state.logout.status = url.searchParams.get('status');
      state.logout.error = url.searchParams.get('error') || null;
    }
    res.writeHead(204);
    res.end();
    if (state.after.visible !== null) setTimeout(() => finish(server, 0), 250);
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

bootServer = http.createServer((req, res) => {
  if (req.url === '/boot' || req.url === '/domain') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page(req.url === '/boot' ? 'proof boot' : 'proof production domain'));
    return;
  }
  res.writeHead(404);
  res.end('not found');
});
bootServer.on('error', (error) => {
  console.error(error);
  finish(server, 2);
});
server.on('error', (error) => {
  console.error(error);
  finish(server, 2);
});
server.listen(0, () => {
  const port = server.address().port;
  bootServer.listen(0, '127.0.0.1', () => {
    const bootPort = bootServer.address().port;
    fs.writeFileSync(path.join(tmp, 'server.json'), JSON.stringify({ port, bootPort }));
    console.log(`listening on ${port} (boot ${bootPort})`);
  });
});

const timeout = setTimeout(() => finish(server, 2), 30_000);
timeout.unref();
