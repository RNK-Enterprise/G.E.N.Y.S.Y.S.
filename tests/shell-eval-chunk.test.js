/**
 * @jest-environment jsdom
 */

/**
 * GENYSYS - classic shell chunk loader coverage
 * Copyright (c) 2026 Asgard Innovations / RNK. All Rights Reserved.
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { evalChunk } from '../src/shell/eval-chunk.js';

beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    delete globalThis.__evalChunkProbe;
    jest.restoreAllMocks();
});

describe('shell: eval chunk loader', () => {
    test('evaluates a chunk in the global scope with the default label', () => {
        evalChunk('globalThis.__evalChunkProbe = { loaded: true };');
        expect(globalThis.__evalChunkProbe).toEqual({ loaded: true });
    });

    test('logs and rethrows source errors with the supplied label', () => {
        const error = new Error('invalid chunk');
        const source = `throw new Error(${JSON.stringify(error.message)});`;
        expect(() => evalChunk(source, 'test-chunk')).toThrow('invalid chunk');
        expect(console.error).toHaveBeenCalledWith(
            '[GENYSYS] Failed to eval chunk test-chunk:',
            expect.any(Error),
        );
    });
});
