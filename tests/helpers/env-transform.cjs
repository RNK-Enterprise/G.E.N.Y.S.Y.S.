/**
 * VEIL™ — import.meta.env emulation for Jest
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * Vite statically replaces `import.meta.env.DEV` at build time; Jest has no
 * equivalent. This transform rewrites the token to a test-controllable global
 * (default false = production semantics) so the fail-closed dev-bypass paths
 * in lisa-bridge.js and veil-auth-gate.js are exercisable in unit tests.
 */

module.exports = {
    process(sourceText) {
        const rewritten = sourceText.replaceAll('import.meta.env.DEV', '__VEIL_DEV__');
        return {
            code: `const __VEIL_DEV__ = globalThis.__VEIL_DEV__ === true;\n${rewritten}`,
        };
    },
};
