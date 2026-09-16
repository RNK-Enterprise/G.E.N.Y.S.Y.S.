/**
 * RNK VEIL™
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 * 
 * Download Manager
 */

export class DownloadManager {
    constructor() {
        this.downloads = [];
        this.nextId = 1;
    }

    startDownload(url, filename) {
        const download = {
            id: this.nextId++,
            url: url,
            filename: filename || this.getFilenameFromUrl(url),
            progress: 0,
            status: 'downloading', // downloading, paused, completed, failed
            startTime: Date.now(),
            bytesDownloaded: 0,
            totalBytes: 0,
            speed: 0
        };

        this.downloads.push(download);
        this.emitEvent('download-started', download);

        // Simulate download progress
        this.simulateDownload(download);

        return download;
    }

    simulateDownload(download) {
        const interval = setInterval(() => {
            if (download.status !== 'downloading') {
                clearInterval(interval);
                return;
            }

            download.progress += Math.random() * 10;
            if (download.progress >= 100) {
                download.progress = 100;
                download.status = 'completed';
                this.emitEvent('download-completed', download);
                clearInterval(interval);
            } else {
                this.emitEvent('download-progress', download);
            }
        }, 500);
    }

    pauseDownload(id) {
        const download = this.downloads.find(d => d.id === id);
        if (download && download.status === 'downloading') {
            download.status = 'paused';
            this.emitEvent('download-paused', download);
        }
    }

    resumeDownload(id) {
        const download = this.downloads.find(d => d.id === id);
        if (download && download.status === 'paused') {
            download.status = 'downloading';
            this.simulateDownload(download);
            this.emitEvent('download-resumed', download);
        }
    }

    cancelDownload(id) {
        const download = this.downloads.find(d => d.id === id);
        if (download) {
            download.status = 'failed';
            this.emitEvent('download-cancelled', download);
        }
    }

    removeDownload(id) {
        const index = this.downloads.findIndex(d => d.id === id);
        if (index >= 0) {
            const [download] = this.downloads.splice(index, 1);
            this.emitEvent('download-removed', download);
            return download;
        }
        return null;
    }

    clearFinishedDownloads() {
        const removable = this.downloads.filter(download => download.status === 'completed' || download.status === 'failed');
        if (removable.length === 0) {
            return 0;
        }

        this.downloads = this.downloads.filter(download => download.status !== 'completed' && download.status !== 'failed');
        removable.forEach(download => this.emitEvent('download-removed', download));
        return removable.length;
    }

    getDownloads() {
        return this.downloads;
    }

    getFilenameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            return pathname.substring(pathname.lastIndexOf('/') + 1) || 'download';
        } catch {
            return 'download';
        }
    }

    emitEvent(eventName, data) {
        window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }
}

export default DownloadManager;
