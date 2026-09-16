/**
 * VEIL™ — Welcome Tour + Daily Lisa Message
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * First sign-in: guided tour + profile setup.
 * Subsequent sign-ins: unique daily message from Lisa, curated per user profile.
 * Message stored with today's date key — never canned, changes every day.
 */

const PROFILE_KEY   = 'veil-user-profile';
const TOUR_DONE_KEY = 'veil-tour-complete';
const MSG_KEY_PREFIX = 'veil-daily-msg-';

// ── Profile helpers ───────────────────────────────────────────────────

function migrateLegacyProfileKeys() {
    // The 2026-09 rename (Axis → VEIL) left user state under `axis-*` keys.
    // Lift it once so profiles, tour completion, and the daily message
    // survive the rename.
    const legacyProfile = localStorage.getItem('axis-user-profile');
    if (legacyProfile && !localStorage.getItem(PROFILE_KEY)) {
        localStorage.setItem(PROFILE_KEY, legacyProfile);
        localStorage.removeItem('axis-user-profile');
    }
    const legacyTour = localStorage.getItem('axis-tour-complete');
    if (legacyTour && !localStorage.getItem(TOUR_DONE_KEY)) {
        localStorage.setItem(TOUR_DONE_KEY, legacyTour);
        localStorage.removeItem('axis-tour-complete');
    }
}

export function getProfile() {
    try {
        migrateLegacyProfileKeys();
        return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    } catch { return null; }
}

export function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function todayKey() {
    return MSG_KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

// ── Daily message ─────────────────────────────────────────────────────

function getDailyMessage() {
    const key = todayKey();
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

function saveDailyMessage(msg) {
    localStorage.setItem(todayKey(), JSON.stringify(msg));
}

function buildStubMessage(profile) {
    const name = profile?.name ? `, ${profile.name}` : '';
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return {
        text: `${greeting}${name}. I'm watching over everything. You have my full attention today.`,
        stub: true,
    };
}

// ── Daily message banner ──────────────────────────────────────────────

function showDailyMessage(msg) {
    const banner = document.createElement('div');
    banner.id = 'veil-daily-message';
    banner.innerHTML = `
        <span class="veil-daily-msg-icon">✦</span>
        <span class="veil-daily-msg-text">${msg.text}</span>
        <button class="veil-daily-msg-close" type="button" title="Dismiss">×</button>
    `;
    document.body.appendChild(banner);
    banner.querySelector('.veil-daily-msg-close').addEventListener('click', () => {
        banner.classList.add('veil-daily-msg-out');
        setTimeout(() => banner.remove(), 300);
    });
    setTimeout(() => banner.classList.add('veil-daily-msg-visible'), 50);
}

// ── Welcome tour ──────────────────────────────────────────────────────

const TOUR_STEPS = [
    {
        id: 'welcome',
        title: 'Welcome to VEIL',
        body: 'VEIL is your private workspace — built around Lisa, secured by the chain. Let\'s set up your profile so Lisa knows you.',
        action: 'Begin',
    },
    {
        id: 'name',
        title: 'What should Lisa call you?',
        body: '',
        field: { id: 'tour-name', label: 'Your name', placeholder: 'Enter your name' },
        action: 'Next',
    },
    {
        id: 'role',
        title: 'What is your role?',
        body: 'This helps Lisa understand the context of your work.',
        field: { id: 'tour-role', label: 'Your role', placeholder: 'e.g. Founder, Engineer, Analyst' },
        action: 'Next',
    },
    {
        id: 'style',
        title: 'How do you prefer to communicate?',
        body: 'Lisa will match your style.',
        choices: [
            { id: 'style-direct', label: 'Direct — no fluff, just facts' },
            { id: 'style-conversational', label: 'Conversational — context and explanation' },
            { id: 'style-brief', label: 'Brief — short answers only' },
        ],
        action: 'Next',
    },
    {
        id: 'finish',
        title: 'You\'re set.',
        body: 'Lisa has your profile. Every session she\'ll greet you with something specific to your day. You can update your profile anytime in Settings.',
        action: 'Enter VEIL',
    },
];

function buildTourOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'veil-tour-overlay';
    overlay.innerHTML = `
        <div id="veil-tour-card">
            <div class="veil-tour-progress"><div class="veil-tour-progress-bar" id="veil-tour-bar"></div></div>
            <div id="veil-tour-title"></div>
            <div id="veil-tour-body"></div>
            <div id="veil-tour-field"></div>
            <div id="veil-tour-choices"></div>
            <button id="veil-tour-action" type="button"></button>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

function renderStep(step, index, total, profile, overlay) {
    const pct = Math.round(((index + 1) / total) * 100);
    overlay.querySelector('#veil-tour-bar').style.width = `${pct}%`;
    overlay.querySelector('#veil-tour-title').textContent = step.title;
    overlay.querySelector('#veil-tour-body').textContent = step.body || '';

    const fieldEl = overlay.querySelector('#veil-tour-field');
    fieldEl.innerHTML = '';
    if (step.field) {
        fieldEl.innerHTML = `
            <label for="${step.field.id}">${step.field.label}</label>
            <input type="text" id="${step.field.id}" placeholder="${step.field.placeholder}" value="${profile[step.id] || ''}">
        `;
    }

    const choicesEl = overlay.querySelector('#veil-tour-choices');
    choicesEl.innerHTML = '';
    if (step.choices) {
        choicesEl.innerHTML = step.choices.map(c => `
            <button class="veil-tour-choice${profile.style === c.id ? ' selected' : ''}" data-choice="${c.id}" type="button">${c.label}</button>
        `).join('');
        choicesEl.querySelectorAll('.veil-tour-choice').forEach(btn => {
            btn.addEventListener('click', () => {
                choicesEl.querySelectorAll('.veil-tour-choice').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
    }

    overlay.querySelector('#veil-tour-action').textContent = step.action;
}

function collectStep(step, overlay, profile) {
    if (step.field) {
        const input = overlay.querySelector(`#${step.field.id}`);
        if (input) profile[step.id] = input.value.trim();
    }
    if (step.choices) {
        const selected = overlay.querySelector('.veil-tour-choice.selected');
        if (selected) profile.style = selected.dataset.choice;
    }
}

export function startTour(onComplete) {
    const overlay = buildTourOverlay();
    const profile = {};
    let index = 0;

    function advance() {
        collectStep(TOUR_STEPS[index], overlay, profile);
        index++;
        if (index >= TOUR_STEPS.length) {
            saveProfile(profile);
            localStorage.setItem(TOUR_DONE_KEY, '1');
            overlay.classList.add('veil-tour-out');
            setTimeout(() => {
                overlay.remove();
                if (typeof onComplete === 'function') onComplete(profile);
            }, 400);
            return;
        }
        renderStep(TOUR_STEPS[index], index, TOUR_STEPS.length, profile, overlay);
    }

    renderStep(TOUR_STEPS[0], 0, TOUR_STEPS.length, profile, overlay);
    overlay.querySelector('#veil-tour-action').addEventListener('click', advance);
}

// ── Entry point ───────────────────────────────────────────────────────

export function initWelcomeSystem(authResult) {
    migrateLegacyProfileKeys();
    const tourDone = localStorage.getItem(TOUR_DONE_KEY);
    const profile = getProfile();

    if (!tourDone) {
        startTour((savedProfile) => {
            const msg = buildStubMessage(savedProfile);
            saveDailyMessage(msg);
            showDailyMessage(msg);
        });
        return;
    }

    let msg = getDailyMessage();
    if (!msg) {
        msg = buildStubMessage(profile);
        saveDailyMessage(msg);
    }
    showDailyMessage(msg);
}
