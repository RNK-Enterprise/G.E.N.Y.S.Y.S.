/** @jest-environment jsdom */

import { beforeEach, describe, expect, test, jest } from '@jest/globals';
import { activeTabId, camofoxBrowser } from '../src/shell/camofox-bridge.js';

describe('Camofox shell capability bridge', () => {
    beforeEach(() => {
        window.tabManager = { activeTabId: 7 };
        window.tauriInvoke = jest.fn(async (command, args) => ({ command, args }));
    });

    test('uses the active logical tab when no tab id is supplied', async () => {
        const result = await camofoxBrowser.snapshot();
        expect(result.command).toBe('camofox_snapshot');
        expect(result.args).toEqual({ tabId: 7, includeScreenshot: false });
    });

    test('publishes typed inspection and interaction commands', async () => {
        await camofoxBrowser.links(3, 10, 2);
        await camofoxBrowser.click(3, 'e1');
        await camofoxBrowser.type(3, null, 'input[name=q]', 'hello', true);
        await camofoxBrowser.press(3, 'Enter');
        await camofoxBrowser.wait(3, 5000, false, true);
        await camofoxBrowser.scroll(3, 'down', 700);
        const commands = window.tauriInvoke.mock.calls.map(([command]) => command);
        expect(commands).toEqual([
            'camofox_links', 'camofox_click', 'camofox_type', 'camofox_press',
            'camofox_wait', 'camofox_scroll',
        ]);
    });

    test('refuses a missing logical tab or native shell', async () => {
        window.tabManager = null;
        expect(() => activeTabId()).toThrow('camofox_active_tab_missing');
        window.tauriInvoke = undefined;
        await expect(camofoxBrowser.status()).rejects.toThrow('camofox_native_shell_required');
    });
});
