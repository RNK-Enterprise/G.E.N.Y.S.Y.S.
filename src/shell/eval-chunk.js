/**
 * VEIL™ — load a classic chunk onto window via indirect eval.
 * Chunks use var/function so bindings attach to the browser global.
 */
export function evalChunk(source, label = 'veil-chunk') {
    try {
        // Indirect eval → global scope (window) in the browser.
        (0, eval)(source);
    } catch (error) {
        console.error(`[VEIL] Failed to eval chunk ${label}:`, error);
        throw error;
    }
}
