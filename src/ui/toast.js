/** GENYSYS ToastManager */
class ToastManager {
    constructor() {
        this.container = document.getElementById('toast-container');
        this.toasts = [];
    }

    show(title, message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✖',
            info: 'ℹ',
            warning: '⚠'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
            <button class="toast-close" aria-label="Close notification">&times;</button>
        `;

        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn?.addEventListener('click', () => this.remove(toast));

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }

        return toast;
    }

    remove(toast) {
        if (!toast || !this.container.contains(toast)) return;

        toast.classList.add('removing');
        setTimeout(() => {
            if (this.container.contains(toast)) {
                this.container.removeChild(toast);
                this.toasts = this.toasts.filter(t => t !== toast);
            }
        }, 300); // Match animation duration
    }

    success(title, message, duration) {
        return this.show(title, message, 'success', duration);
    }

    error(title, message, duration) {
        return this.show(title, message, 'error', duration);
    }

    info(title, message, duration) {
        return this.show(title, message, 'info', duration);
    }

    warning(title, message, duration) {
        return this.show(title, message, 'warning', duration);
    }

    clear() {
        this.toasts.forEach(toast => this.remove(toast));
    }
}

export { ToastManager };
export default ToastManager;
