/**
 * GENYSYS Camofox backend status surface.
 * The native status command remains the authority; this module only renders it.
 */

const STATUS_ID = 'camofox-status';

function statusNode() {
    return document.getElementById(STATUS_ID);
}

function refusalReason(status) {
    return status?.backendStatus?.service?.error
        || status?.backendStatus?.vnc?.error
        || 'camofox_not_ready';
}

export function renderCamofoxStatus(status) {
    const node = statusNode();
    if (!node) return;
    const selected = status?.configuredBackend === 'camofox';
    node.hidden = !selected;
    node.classList.toggle('connected', Boolean(selected && status?.backendStatus?.ready));
    if (!selected) {
        node.textContent = 'Camofox: not selected';
        node.title = 'GENYSYS is using the WebKit backend';
        return;
    }
    const ready = Boolean(status?.backendStatus?.ready);
    node.textContent = ready ? 'Camofox: Ready' : `Camofox: Hold (${refusalReason(status)})`;
    node.title = ready
        ? 'Camofox service and live surface are ready'
        : `Camofox is fail-closed: ${refusalReason(status)}`;
}

export async function refreshCamofoxStatus(invoke = window.tauriInvoke) {
    if (typeof invoke !== 'function') {
        renderCamofoxStatus(null);
        return null;
    }
    try {
        const status = await invoke('tab_window_status');
        renderCamofoxStatus(status);
        return status;
    } catch (error) {
        const node = statusNode();
        if (node) {
            node.hidden = false;
            node.classList.remove('connected');
            node.textContent = 'Camofox: Hold (status_unavailable)';
            node.title = `Camofox status unavailable: ${error?.message || 'unknown_error'}`;
        }
        return null;
    }
}

window.refreshCamofoxStatus = refreshCamofoxStatus;
