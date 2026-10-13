/**
 * GENYSYS™ — extracted from main.js
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 */

function bindClickHandlers(entries) {
    entries.forEach(([target, handler]) => {
        const element = typeof target === 'string' ? document.getElementById(target) : target;
        if (element) {
            element.addEventListener('click', handler);
        }
    });
}

function bindModalActionButton(item, selector, handler) {
    const button = item.querySelector(selector);
    if (button) {
        button.addEventListener('click', handler);
    }
}

function bindItemEvents(items, { click, mouseenter } = {}) {
    items.forEach((item, index) => {
        if (click) {
            item.addEventListener('click', event => click(item, index, event));
        }
        if (mouseenter) {
            item.addEventListener('mouseenter', event => mouseenter(item, index, event));
        }
    });
}

function bindButtonAction(button, handler, { stopPropagation = false, preventDefault = false } = {}) {
    if (!button) return;
    button.addEventListener('click', event => {
        if (preventDefault) {
            event.preventDefault();
        }
        if (stopPropagation) {
            event.stopPropagation();
        }
        handler(event);
    });
}

function bindCardActionButton(button, action) {
    if (!button || !action) return;
    bindButtonAction(button, action, { stopPropagation: true, preventDefault: true });
}

function bindModalCloseButtons() {
    document.querySelectorAll('.modal-close').forEach(button => {
        bindButtonAction(button, (event) => {
            window.hideModal(event.target.closest('.modal'));
        });
    });
}

function bindTabElementInteractions(tabElement, tab, index, sortedTabs, manager) {
    bindButtonAction(tabElement, (event) => {
        if (!event.target.classList.contains('tab-close')) {
            manager.activateTab(tab.id);
        }
    });

    tabElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            manager.activateTab(tab.id);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            const prevTab = sortedTabs[index - 1];
            if (prevTab) {
                const prevElement = document.querySelector(`[data-tab-id="${prevTab.id}"]`);
                prevElement?.focus();
            }
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            const nextTab = sortedTabs[index + 1];
            if (nextTab) {
                const nextElement = document.querySelector(`[data-tab-id="${nextTab.id}"]`);
                nextElement?.focus();
            }
        }
    });

    tabElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        manager.showTabContextMenu(tab.id, event.clientX, event.clientY);
    });

    const closeBtn = tabElement.querySelector('.tab-close');
    bindButtonAction(closeBtn, (event) => {
        event.stopPropagation();
        event.target.classList.add('button-press');
        setTimeout(() => {
            manager.closeTab(tab.id);
        }, 100);
    });

    tabElement.addEventListener('dragstart', (event) => manager.handleDragStart(event, tab.id));
    tabElement.addEventListener('dragover', (event) => manager.handleDragOver(event, tab.id));
    tabElement.addEventListener('drop', (event) => manager.handleDrop(event, tab.id));
    tabElement.addEventListener('dragend', (event) => manager.handleDragEnd(event));
}
window.bindClickHandlers = bindClickHandlers;
window.bindModalActionButton = bindModalActionButton;
window.bindItemEvents = bindItemEvents;
window.bindButtonAction = bindButtonAction;
window.bindCardActionButton = bindCardActionButton;
window.bindModalCloseButtons = bindModalCloseButtons;
window.bindTabElementInteractions = bindTabElementInteractions;

window.bindClickHandlers = bindClickHandlers;
window.bindModalActionButton = bindModalActionButton;
window.bindItemEvents = bindItemEvents;
window.bindButtonAction = bindButtonAction;
window.bindCardActionButton = bindCardActionButton;
window.bindModalCloseButtons = bindModalCloseButtons;
window.bindTabElementInteractions = bindTabElementInteractions;
