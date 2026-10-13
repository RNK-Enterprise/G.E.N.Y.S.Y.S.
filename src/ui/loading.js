/** GENYSYS LoadingManager */
class LoadingManager {
    constructor() {
        this.overlay = null;
    }

    show(message = 'Loading...') {
        if (this.overlay) return;

        this.overlay = document.createElement('div');
        this.overlay.className = 'loading-overlay';
    this.overlay.innerHTML = `
            <div class="loading-spinner" role="status"></div>
            <div class="loading-text">${message}</div>
        `;
        document.body.appendChild(this.overlay);
        window.applyLoadingDensityState?.(this.overlay);
    }

    hide() {
        if (this.overlay && document.body.contains(this.overlay)) {
            document.body.removeChild(this.overlay);
            this.overlay = null;
        }
    }

    update(message) {
        if (this.overlay) {
            const text = this.overlay.querySelector('.loading-text');
            if (text) text.textContent = message;
        }
    }
}

export { LoadingManager };
export default LoadingManager;
