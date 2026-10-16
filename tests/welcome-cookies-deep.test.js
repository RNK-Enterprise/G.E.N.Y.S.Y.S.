/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS - welcome and cookies lifecycle coverage
 * Copyright (c) 2026 Asgard Innovations / RNK. All Rights Reserved.
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as tour from '../src/genysys-welcome-tour.js';

const dayKey = () => `genysys-daily-msg-${new Date().toISOString().slice(0, 10)}`;
const pause = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    document.body.innerHTML = '';
});

async function importCookiesBar() {
    jest.resetModules();
    return import(`../src/genysys-cookies-bar.js?case=${Date.now()}-${Math.random()}`);
}

function finishTour({ name, role, choice, selectChoice = true, removeNameInput = false, onComplete } = {}) {
    tour.startTour(onComplete);
    const overlay = document.getElementById('genysys-tour-overlay');
    overlay.querySelector('#genysys-tour-action').click();
    if (removeNameInput) {
        document.getElementById('tour-name').remove();
    } else {
        document.getElementById('tour-name').value = name || '';
    }
    overlay.querySelector('#genysys-tour-action').click();
    document.getElementById('tour-role').value = role || '';
    overlay.querySelector('#genysys-tour-action').click();
    if (selectChoice) overlay.querySelector(`[data-choice="${choice}"]`).click();
    overlay.querySelector('#genysys-tour-action').click();
    overlay.querySelector('#genysys-tour-action').click();
}

describe('welcome system: migration, malformed state, and message safety', () => {
    test('migrates legacy profile and tour state and handles invalid JSON', () => {
        localStorage.setItem('axis-user-profile', JSON.stringify({ name: 'Legacy' }));
        localStorage.setItem('axis-tour-complete', '1');
        expect(tour.getProfile()).toEqual({ name: 'Legacy' });
        expect(localStorage.getItem('genysys-tour-complete')).toBe('1');
        expect(localStorage.getItem('axis-user-profile')).toBeNull();
        expect(localStorage.getItem('axis-tour-complete')).toBeNull();

        localStorage.setItem('genysys-user-profile', 'not-json{{');
        expect(tour.getProfile()).toBeNull();
        tour.saveProfile({ name: 'Saved' });
        expect(tour.getProfile()).toEqual({ name: 'Saved' });
    });

    test('covers all greeting periods and an escaped stored daily message', () => {
        for (const [hour, greeting] of [[10, 'Good morning'], [15, 'Good afternoon'], [20, 'Good evening']]) {
            jest.spyOn(Date.prototype, 'getHours').mockReturnValue(hour);
            localStorage.clear();
            localStorage.setItem('genysys-tour-complete', '1');
            localStorage.setItem('genysys-user-profile', JSON.stringify({}));
            tour.initWelcomeSystem({});
            expect(document.querySelector('.genysys-daily-msg-text').textContent).toContain(greeting);
            document.getElementById('genysys-daily-message').remove();
            jest.restoreAllMocks();
        }

        const hostile = '<img src=x onerror=alert(1)>';
        localStorage.setItem('genysys-tour-complete', '1');
        localStorage.setItem('genysys-user-profile', JSON.stringify({}));
        localStorage.setItem(dayKey(), JSON.stringify({ text: hostile }));
        tour.initWelcomeSystem({});
        const text = document.querySelector('.genysys-daily-msg-text');
        expect(text.textContent).toBe(hostile);
        expect(text.querySelector('img')).toBeNull();

        document.getElementById('genysys-daily-message').remove();
        localStorage.setItem(dayKey(), JSON.stringify({}));
        tour.initWelcomeSystem({});
        expect(document.querySelector('.genysys-daily-msg-text').textContent).toBe('');
    });

    test('completes a tour without a callback or selected choice', () => {
        finishTour({ removeNameInput: true, selectChoice: false });
        expect(JSON.parse(localStorage.getItem('genysys-user-profile'))).toEqual({ role: '' });
        expect(localStorage.getItem('genysys-tour-complete')).toBe('1');
        jest.advanceTimersByTime(400);
        expect(document.getElementById('genysys-tour-overlay')).toBeNull();
    });

    test('dismisses a generated daily message and tolerates malformed daily storage', () => {
        localStorage.setItem('genysys-tour-complete', '1');
        localStorage.setItem('genysys-user-profile', JSON.stringify({ name: 'Odinn' }));
        localStorage.setItem(dayKey(), 'not-json{{');
        tour.initWelcomeSystem({});
        const banner = document.getElementById('genysys-daily-message');
        expect(banner.textContent).toContain('Odinn');
        banner.querySelector('.genysys-daily-msg-close').click();
        jest.advanceTimersByTime(350);
        expect(document.getElementById('genysys-daily-message')).toBeNull();
    });
});

describe('cookies bar: migration and ready-state paths', () => {
    test('migrates legacy acceptance without rendering the bar', async () => {
        localStorage.setItem('axis-cookies-accepted', '1');
        await importCookiesBar();
        expect(localStorage.getItem('genysys-cookies-accepted')).toBe('1');
        expect(localStorage.getItem('axis-cookies-accepted')).toBeNull();
        expect(document.getElementById('genysys-cookies-bar')).toBeNull();
    });

    test('defers bar creation until DOMContentLoaded while loading', async () => {
        Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
        await importCookiesBar();
        expect(document.getElementById('genysys-cookies-bar')).toBeNull();
        document.dispatchEvent(new Event('DOMContentLoaded'));
        expect(document.getElementById('genysys-cookies-bar')).not.toBeNull();
        document.getElementById('genysys-cookies-accept').click();
        jest.advanceTimersByTime(300);
        expect(document.getElementById('genysys-cookies-bar')).toBeNull();
        Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
    });

    test('does nothing when canonical acceptance already exists', async () => {
        localStorage.setItem('genysys-cookies-accepted', '1');
        await importCookiesBar();
        expect(document.getElementById('genysys-cookies-bar')).toBeNull();
    });
});
