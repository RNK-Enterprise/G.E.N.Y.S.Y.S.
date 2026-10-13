/**
 * GENYSYS™ — DownloadManager unit tests
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

global.window = { dispatchEvent: () => {} };
global.CustomEvent = class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };

const { describe, expect, test, beforeEach, afterEach, jest } = await import('@jest/globals');
const { DownloadManager } = await import('../src/download-manager.js');

describe('DownloadManager', () => {
  let events;
  beforeEach(() => {
    jest.useFakeTimers();
    events = [];
    global.window.dispatchEvent = (e) => events.push(e.type);
  });
  afterEach(() => jest.useRealTimers());

  test('startDownload derives the filename from the URL', () => {
    const dm = new DownloadManager();
    const d = dm.startDownload('https://example.com/files/report.pdf');
    expect(d.filename).toBe('report.pdf');
    expect(d.status).toBe('downloading');
    expect(d.id).toBe(1);
  });

  test('explicit filename wins; invalid URL falls back to "download"', () => {
    const dm = new DownloadManager();
    expect(dm.startDownload('https://x.test/a.bin', 'named.bin').filename).toBe('named.bin');
    expect(dm.startDownload('not a url').filename).toBe('download');
    expect(dm.startDownload('https://x.test').filename).toBe('download');
  });

  test('progress completes and emits started/progress/completed', () => {
    const dm = new DownloadManager();
    const d = dm.startDownload('https://example.com/f.bin');
    expect(events).toContain('download-started');
    jest.advanceTimersByTime(20000);
    expect(d.progress).toBe(100);
    expect(d.status).toBe('completed');
    expect(events).toContain('download-progress');
    expect(events).toContain('download-completed');
  });

  test('pause stops progress; resume restarts it', () => {
    const dm = new DownloadManager();
    const d = dm.startDownload('https://example.com/f.bin');
    dm.pauseDownload(d.id);
    expect(d.status).toBe('paused');
    jest.advanceTimersByTime(5000);
    const frozen = d.progress;
    dm.resumeDownload(d.id);
    expect(d.status).toBe('downloading');
    jest.advanceTimersByTime(5000);
    expect(d.progress).toBeGreaterThan(frozen);
    expect(events).toContain('download-paused');
    expect(events).toContain('download-resumed');
  });

  test('pause on unknown or non-downloading id does nothing', () => {
    const dm = new DownloadManager();
    dm.pauseDownload(999);
    const d = dm.startDownload('https://example.com/f.bin');
    dm.pauseDownload(d.id);
    dm.pauseDownload(d.id);
    expect(d.status).toBe('paused');
  });

  test('cancel marks failed and freezes the interval', () => {
    const dm = new DownloadManager();
    const d = dm.startDownload('https://example.com/f.bin');
    dm.cancelDownload(d.id);
    expect(d.status).toBe('failed');
    jest.advanceTimersByTime(20000);
    expect(d.progress).toBeLessThan(100);
    expect(events).toContain('download-cancelled');
  });

  test('remove deletes and returns the download; unknown id returns null', () => {
    const dm = new DownloadManager();
    const d = dm.startDownload('https://example.com/f.bin');
    jest.advanceTimersByTime(20000);
    expect(dm.removeDownload(d.id)).toMatchObject({ id: d.id });
    expect(dm.removeDownload(d.id)).toBeNull();
    expect(dm.getDownloads()).toHaveLength(0);
  });

  test('clearFinishedDownloads removes completed/failed only', () => {
    const dm = new DownloadManager();
    const a = dm.startDownload('https://example.com/a.bin');
    const b = dm.startDownload('https://example.com/b.bin');
    jest.advanceTimersByTime(20000);
    const c = dm.startDownload('https://example.com/c.bin');
    dm.pauseDownload(c.id);
    expect(dm.clearFinishedDownloads()).toBe(2);
    expect(dm.getDownloads()).toEqual([c]);
    expect(dm.clearFinishedDownloads()).toBe(0);
    expect(b.status).toBe('completed');
    expect(a.status).toBe('completed');
  });
});
