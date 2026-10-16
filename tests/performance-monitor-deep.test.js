/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS - performance monitor runtime coverage
 * Copyright (c) 2026 Asgard Innovations / RNK. All Rights Reserved.
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { PerformanceMonitor } from '../src/perf/performance-monitor.js';

function makeCanvas() {
    const canvas = document.createElement('canvas');
    canvas.id = 'perf-canvas';
    canvas.width = 200;
    canvas.height = 100;
    const calls = [];
    const context = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        fillRect: (...args) => calls.push(['fillRect', ...args]),
        beginPath: () => calls.push(['beginPath']),
        moveTo: (...args) => calls.push(['moveTo', ...args]),
        lineTo: (...args) => calls.push(['lineTo', ...args]),
        stroke: () => calls.push(['stroke']),
    };
    canvas.getContext = () => context;
    canvas.__calls = calls;
    return canvas;
}

function installMetrics() {
    document.body.innerHTML = `
        <div id="performance-panel" class="hidden"></div>
        <div id="perf-summary-state"></div>
        <div id="perf-summary-text"></div>
        <div id="perf-memory"></div>
        <div id="perf-cpu"></div>
        <div id="perf-tabs"></div>
        <div id="perf-network"></div>
    `;
    document.body.appendChild(makeCanvas());
}

function setMemory(value) {
    Object.defineProperty(performance, 'memory', {
        configurable: true,
        value: value === null ? undefined : { usedJSHeapSize: value * 1048576 },
    });
}

beforeEach(() => {
    installMetrics();
    setMemory(null);
    delete window.tabManager;
    delete window.genysysBridge;
    delete window.genysysRuntime;
    delete window.setGENYSYSSidebarStateBadge;
    delete window.isGENYSYSCapabilityAvailable;
    delete window.showElement;
    delete window.hideElement;
    delete window.applyPerformancePanelDensityState;
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('performance monitor: metrics and chart paths', () => {
    test('reports offline metrics and stops scheduled updates safely', () => {
        const badge = jest.fn();
        window.setGENYSYSSidebarStateBadge = badge;
        window.tabManager = { tabs: [] };
        const monitor = new PerformanceMonitor();
        jest.spyOn(Math, 'random').mockReturnValue(0);

        monitor.start();
        monitor.start();
        expect(monitor.running).toBe(true);
        expect(document.getElementById('perf-memory').textContent).toBe('N/A MB');
        expect(document.getElementById('perf-cpu').textContent).toBe('10%');
        expect(document.getElementById('perf-tabs').textContent).toBe('0');
        expect(document.getElementById('perf-network').textContent).toBe('Idle');
        expect(document.getElementById('perf-summary-text').textContent).toContain('offline');
        expect(badge).toHaveBeenCalledWith(
            document.getElementById('perf-summary-state'),
            'Idle',
            'idle',
        );
        expect(monitor.history.memory).toEqual([0]);
        expect(document.getElementById('perf-canvas').__calls.filter(call => call[0] === 'lineTo')).toHaveLength(5);

        monitor.stop();
        jest.advanceTimersByTime(1000);
        document.getElementById('perf-canvas').remove();
        monitor.drawChart();
    });

    test('reports ready and busy states and draws both history lines', () => {
        setMemory(42.125);
        window.tabManager = { tabs: [{}, {}] };
        window.genysysBridge = {
            connected: true,
            listTurboStates: () => [{ enabled: true }, { enabled: false }],
        };
        const badge = jest.fn();
        window.setGENYSYSSidebarStateBadge = badge;
        jest.spyOn(Math, 'random').mockReturnValue(0);
        const monitor = new PerformanceMonitor();
        monitor.running = true;
        monitor.update();
        monitor.update();
        jest.clearAllTimers();

        expect(document.getElementById('perf-memory').textContent).toBe('42.13 MB');
        expect(document.getElementById('perf-network').textContent).toBe('Active');
        expect(document.getElementById('perf-summary-text').textContent).toContain('live turbos');
        expect(monitor.history.memory).toHaveLength(2);
        expect(monitor.history.cpu).toHaveLength(2);
        expect(document.getElementById('perf-canvas').__calls.filter(call => call[0] === 'lineTo').length).toBeGreaterThan(0);
        expect(badge).toHaveBeenCalledWith(
            document.getElementById('perf-summary-state'),
            'Ready',
            'ready',
        );

        setMemory(701);
        monitor.maxHistory = 2;
        monitor.update();
        jest.clearAllTimers();
        expect(document.getElementById('perf-summary-text').textContent).toContain('under load');
        expect(badge).toHaveBeenLastCalledWith(
            document.getElementById('perf-summary-state'),
            'Busy',
            'busy',
        );
        document.getElementById('perf-summary-text').remove();
        monitor.update();
        jest.clearAllTimers();
        expect(document.getElementById('perf-summary-state')).not.toBeNull();
        expect(document.getElementById('perf-memory').textContent).toBe('701.00 MB');
    });
});

describe('performance monitor: panel toggle paths', () => {
    test('guards capability and panel, then toggles through native helpers', () => {
        const monitor = new PerformanceMonitor();
        const panel = document.getElementById('performance-panel');
        window.isGENYSYSCapabilityAvailable = () => false;
        monitor.toggle();
        expect(panel.classList.contains('hidden')).toBe(true);

        window.isGENYSYSCapabilityAvailable = () => true;
        panel.remove();
        monitor.toggle();
        expect(monitor.running).toBe(false);

        installMetrics();
        const activePanel = document.getElementById('performance-panel');
        window.applyPerformancePanelDensityState = jest.fn();
        window.showElement = (element) => {
            element.classList.remove('hidden');
            return element;
        };
        window.hideElement = (element) => {
            element.classList.add('hidden');
            return element;
        };
        monitor.toggle();
        expect(monitor.running).toBe(true);
        expect(window.applyPerformancePanelDensityState).toHaveBeenCalled();
        monitor.toggle();
        expect(monitor.running).toBe(false);
        expect(activePanel.classList.contains('hidden')).toBe(true);

        delete window.showElement;
        activePanel.classList.add('hidden');
        monitor.toggle();
        expect(monitor.running).toBe(true);
        delete window.hideElement;
        monitor.toggle();
        expect(monitor.running).toBe(false);
        expect(activePanel.classList.contains('hidden')).toBe(true);
    });
});
