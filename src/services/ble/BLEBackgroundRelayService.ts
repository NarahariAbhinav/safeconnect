/**
 * BLEBackgroundRelayService.ts — Continuous Offline Mesh Relay
 *
 * Automatically relays queued packets every 30 seconds
 * Ensures messages reach peers even when app is in foreground
 *
 * Works in conjunction with BLEMeshService:
 *  - BLEMeshService handles discovery & connection
 *  - BLEBackgroundRelayService ensures continuous attempts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { bleMeshService } from './BLEMeshService';

class BLEBackgroundRelayServiceClass {
    private relayInterval: NodeJS.Timeout | null = null;
    private isRelaying = false;
    private _active = false;

    get active() { return this._active; }

    /**
     * Start continuous background relay
     * This keeps trying to find nearby peers and send queued messages
     */
    async startRelay(): Promise<void> {
        if (this.relayInterval) {
            console.log('[BLERelay] Already running');
            return;
        }

        if (!bleMeshService.ready) {
            console.warn('[BLERelay] BLE not ready yet, waiting...');
            // Wait up to 5 seconds for BLE to initialize
            for (let i = 0; i < 5; i++) {
                if (bleMeshService.ready) break;
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (!bleMeshService.ready) {
            console.error('[BLERelay] BLE still not ready, cannot start relay');
            return;
        }

        console.log('[BLERelay] Starting background relay (every 30s)');
        this._active = true;

        // Try relay immediately
        await this._attemptRelay();

        // Then every 30 seconds
        this.relayInterval = setInterval(async () => {
            await this._attemptRelay();
        }, 30000);
    }

    stopRelay(): void {
        if (this.relayInterval) {
            clearInterval(this.relayInterval);
            this.relayInterval = null;
            this._active = false;
            console.log('[BLERelay] Stopped');
        }
    }

    /**
     * Get count of pending packets waiting to be relayed
     */
    async getPendingCount(): Promise<number> {
        const raw = await AsyncStorage.getItem('ble_relay_queue');
        if (!raw) return 0;
        const queue = JSON.parse(raw);
        return queue.length ?? 0;
    }

    /**
     * Force immediate relay attempt (call when user returns to app or in focus)
     */
    async forceRelay(): Promise<void> {
        console.log('[BLERelay] Force relay triggered');
        await this._attemptRelay();
    }

    // ── Internal ──────────────────────────────────────────────────

    private async _attemptRelay(): Promise<void> {
        if (this.isRelaying || !bleMeshService.ready) return;
        this.isRelaying = true;

        try {
            // Get queued packets
            const queue = await this._getRelayQueue();
            if (queue.length === 0) {
                // console.log('[BLERelay] No pending packets');
                this.isRelaying = false;
                return;
            }

            console.log(`[BLERelay] Attempting to relay ${queue.length} packet(s)...`);

            // Try to broadcast the first packet in queue
            // This will scan for nearby peers and write to them
            const pkt = queue[0];
            await bleMeshService.broadcast(pkt);

            // Check queue again - if packet was successfully relayed, it should be cleaned
            const updatedQueue = await this._getRelayQueue();
            if (updatedQueue.length < queue.length) {
                console.log('[BLERelay] Packet relayed successfully');
            }
        } catch (e) {
            console.warn('[BLERelay] Relay attempt error:', (e as any)?.message);
        } finally {
            this.isRelaying = false;
        }
    }

    private async _getRelayQueue(): Promise<any[]> {
        const raw = await AsyncStorage.getItem('ble_relay_queue');
        return raw ? JSON.parse(raw) : [];
    }
}

export const bleBackgroundRelayService = new BLEBackgroundRelayServiceClass();
export default bleBackgroundRelayService;
