/**
 * batteryService.ts — Battery-Aware Power Management
 *
 * Monitors battery level and switches the app to low-power mode
 * when battery drops below thresholds. This reduces:
 *  - BLE scan frequency (30s → 120s windows)
 *  - Connectivity ping interval (10s → 60s)
 *  - GPS polling (5min → 15min)
 *  - Firebase polling (15s → 60s)
 *
 * Also broadcasts a "battery critical" BLE packet when < 5%
 * so rescue teams know time is limited.
 */


// ─── Battery Levels ─────────────────────────────────────────────────
export type PowerMode = 'normal' | 'low' | 'critical';

export interface BatteryState {
    level: number;          // 0-1 (0.15 = 15%)
    isCharging: boolean;
    mode: PowerMode;
}

// ─── Intervals for each mode (in ms) ───────────────────────────────
export const POWER_PROFILES = {
    normal: {
        bleScanWindow: 30_000,       // 30s scan window
        bleScanPause: 5_000,         // 5s between scans
        connectivityPing: 10_000,    // ping every 10s
        gpsBreadcrumb: 5 * 60_000,   // GPS every 5 min
        firebasePoll: 15_000,        // poll govtAction every 15s
        heartbeat: 60_000,           // heartbeat every 60s
    },
    low: {                            // battery < 20%
        bleScanWindow: 15_000,       // 15s scan (shorter)
        bleScanPause: 60_000,        // 60s pause between scans
        connectivityPing: 30_000,    // ping every 30s
        gpsBreadcrumb: 10 * 60_000,  // GPS every 10 min
        firebasePoll: 45_000,        // poll every 45s
        heartbeat: 120_000,          // heartbeat every 2 min
    },
    critical: {                      // battery < 5%
        bleScanWindow: 10_000,       // 10s scan (minimal)
        bleScanPause: 180_000,       // 3 min pause
        connectivityPing: 60_000,    // ping every 60s
        gpsBreadcrumb: 15 * 60_000,  // GPS every 15 min
        firebasePoll: 120_000,       // poll every 2 min
        heartbeat: 300_000,          // heartbeat every 5 min
    },
} as const;

// ─── Battery Monitor Class ──────────────────────────────────────────
class BatteryServiceClass {
    private _level: number = 1;
    private _charging: boolean = false;
    private _mode: PowerMode = 'normal';
    private _listeners: ((state: BatteryState) => void)[] = [];
    private _pollInterval: ReturnType<typeof setInterval> | null = null;

    get level(): number { return this._level; }
    get isCharging(): boolean { return this._charging; }
    get mode(): PowerMode { return this._mode; }
    get profile() { return POWER_PROFILES[this._mode]; }
    get state(): BatteryState {
        return { level: this._level, isCharging: this._charging, mode: this._mode };
    }

    /**
     * Start monitoring battery level.
     * Uses expo-battery if available, falls back to reasonable defaults.
     */
    async init(): Promise<void> {
        await this._readBattery();
        // Poll battery every 30s (battery readings are cheap)
        this._pollInterval = setInterval(() => this._readBattery(), 30_000);
    }

    private async _readBattery(): Promise<void> {
        try {
            // Try expo-battery (works in dev builds)
            const Battery = require('expo-battery');
            this._level = await Battery.getBatteryLevelAsync();
            const battState = await Battery.getBatteryStateAsync();
            this._charging = battState === Battery.BatteryState.CHARGING ||
                battState === Battery.BatteryState.FULL;
        } catch {
            // expo-battery not available (Expo Go or web) — assume normal
            this._level = 0.8;
            this._charging = false;
        }

        // Determine power mode
        const prevMode = this._mode;
        if (this._charging) {
            this._mode = 'normal'; // Always normal when charging
        } else if (this._level < 0.05) {
            this._mode = 'critical';
        } else if (this._level < 0.20) {
            this._mode = 'low';
        } else {
            this._mode = 'normal';
        }

        // Notify listeners on mode change
        if (prevMode !== this._mode) {
            console.log(`[Battery] Mode changed: ${prevMode} → ${this._mode} (${Math.round(this._level * 100)}%)`);
            this._listeners.forEach(cb => cb(this.state));
        }
    }

    /** Subscribe to power mode changes */
    onModeChange(cb: (state: BatteryState) => void): () => void {
        this._listeners.push(cb);
        return () => {
            this._listeners = this._listeners.filter(l => l !== cb);
        };
    }

    /** Get human-readable battery info */
    getDisplayInfo(): { percent: string; icon: string; color: string } {
        const pct = Math.round(this._level * 100);
        if (this._charging) return { percent: `${pct}%`, icon: '🔌', color: '#2A7A5A' };
        if (pct <= 5) return { percent: `${pct}%`, icon: '🪫', color: '#C62828' };
        if (pct <= 20) return { percent: `${pct}%`, icon: '🔋', color: '#D84315' };
        return { percent: `${pct}%`, icon: '🔋', color: '#2A7A5A' };
    }

    destroy(): void {
        if (this._pollInterval) clearInterval(this._pollInterval);
        this._listeners = [];
    }
}

export const batteryService = new BatteryServiceClass();
export default batteryService;
