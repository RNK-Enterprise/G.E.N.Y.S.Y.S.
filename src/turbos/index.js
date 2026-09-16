/**
 * Register live VEIL performance turbos.
 */
import { tabSuspend } from './tab-suspend.js';
import { memoryReclaim } from './memory-reclaim.js';
import { navPrefetch } from './nav-prefetch.js';
import { dnsCache } from './dns-cache.js';
import { renderThrottle } from './render-throttle.js';
import { imageLazyShell } from './image-lazy-shell.js';
import { cacheBudget } from './cache-budget.js';
import { startupDefer } from './startup-defer.js';
import { networkIdle } from './network-idle.js';

export function createLiveTurbos(ctx = {}) {
  return {
    'turbo-tab-suspend': tabSuspend(ctx),
    'turbo-memory-reclaim': memoryReclaim(ctx),
    'turbo-nav-prefetch': navPrefetch(ctx),
    'turbo-dns-cache': dnsCache(ctx),
    'turbo-render-throttle': renderThrottle(ctx),
    'turbo-image-lazy-shell': imageLazyShell(ctx),
    'turbo-cache-budget': cacheBudget(ctx),
    'turbo-startup-defer': startupDefer(ctx),
    'turbo-network-idle': networkIdle(ctx),
    // implementation-key aliases
    'tab-suspend': tabSuspend(ctx),
    'memory-reclaim': memoryReclaim(ctx),
    'nav-prefetch': navPrefetch(ctx),
    'dns-cache': dnsCache(ctx),
    'render-throttle': renderThrottle(ctx),
    'image-lazy-shell': imageLazyShell(ctx),
    'cache-budget': cacheBudget(ctx),
    'startup-defer': startupDefer(ctx),
    'network-idle': networkIdle(ctx),
  };
}
