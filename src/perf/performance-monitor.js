/** VEIL PerformanceMonitor — expects veilBridge, tabManager, setVEILSidebarStateBadge globals */
class PerformanceMonitor {
    constructor() {
        this.history = {
            memory: [],
            cpu: [],
            timestamps: []
        };
        this.maxHistory = 60;
        this.running = false;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.update();
    }

    stop() {
        this.running = false;
    }

    update() {
        if (!this.running) return;
        
        // Get performance metrics
        const memoryValue = performance.memory ? (performance.memory.usedJSHeapSize / 1048576) : NaN;
        const memory = Number.isFinite(memoryValue) ? memoryValue.toFixed(2) : 'N/A';
        
        // Simulate CPU (would need actual measurement)
        const cpu = Math.floor(Math.random() * 20 + 10);
        const tabs = window.tabManager?.tabs?.length || 0;
        const bridge = window.veilBridge || window.veilRuntime;
        const veilConnected = Boolean(bridge && bridge.connected);
        const liveTurbos = bridge?.listTurboStates?.()?.filter((t) => t.enabled).length ?? 0;
        const perfSummaryState = document.getElementById('perf-summary-state');
        const perfSummaryText = document.getElementById('perf-summary-text');
        const perfStatusTone = Number.isFinite(memoryValue) && (memoryValue > 700 || cpu > 60) ? 'busy' : veilConnected ? 'ready' : 'idle';
        
        // Update displays
        document.getElementById('perf-memory').textContent = `${memory} MB`;
        document.getElementById('perf-cpu').textContent = `${cpu}%`;
        document.getElementById('perf-tabs').textContent = tabs;
        document.getElementById('perf-network').textContent = veilConnected ? 'Active' : 'Idle';
        window.setVEILSidebarStateBadge?.(perfSummaryState, perfStatusTone === 'busy' ? 'Busy' : veilConnected ? 'Ready' : 'Idle', perfStatusTone);
        if (perfSummaryText) {
            perfSummaryText.textContent = perfStatusTone === 'busy'
                ? `VEIL under load with ${tabs} tabs and ${memory === 'N/A' ? 'unknown' : `${memory} MB`} memory.`
                : veilConnected
                    ? `VEIL runtime online · ${liveTurbos} live turbos · ${tabs} tabs.`
                    : `VEIL runtime offline — start it from the status indicator.`;
        }
        
        // Update history
        this.history.memory.push(Number.isFinite(memoryValue) ? memoryValue : 0);
        this.history.cpu.push(cpu);
        this.history.timestamps.push(Date.now());
        
        if (this.history.memory.length > this.maxHistory) {
            this.history.memory.shift();
            this.history.cpu.shift();
            this.history.timestamps.shift();
        }
        
        this.drawChart();
        
        setTimeout(() => this.update(), 1000);
    }

    drawChart() {
        const canvas = document.getElementById('perf-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = (height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Draw memory line
        if (this.history.memory.length > 1) {
            ctx.strokeStyle = '#8ab4f8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            this.history.memory.forEach((value, index) => {
                const x = (width / this.maxHistory) * index;
                const y = height - (value / 200) * height;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        }
        
        // Draw CPU line
        if (this.history.cpu.length > 1) {
            ctx.strokeStyle = '#ff6b00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            this.history.cpu.forEach((value, index) => {
                const x = (width / this.maxHistory) * index;
                const y = height - (value / 100) * height;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        }
    }

    toggle() {
        if (!window.isVEILCapabilityAvailable?.('veil-performance-stack')) {
            return;
        }

        const panel = document.getElementById('performance-panel');
        if (!panel) return;
        if (panel.classList.contains('hidden')) {
            window.showElement?.(panel) ?? panel.classList.remove('hidden');
        } else {
            window.hideElement?.(panel) ?? panel.classList.add('hidden');
        }
        window.applyPerformancePanelDensityState?.();

        if (!panel.classList.contains('hidden')) {
            this.start();
        } else {
            this.stop();
        }
    }
}

export { PerformanceMonitor };
export default PerformanceMonitor;
