/**
 * BLEBackgroundRelayService.ts — Continuous Offline Relay
 *
 * Runs every 30 seconds trying to deliver queued mesh packets to nearby peers.
 * Works alongside BLEMeshService:
 *   - BLEMeshService handles connections and incoming packets
 *   - This service ensures OUTGOING queued packets keep retrying
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bleMeshService } from './BLEMeshService';

class BLEBackgroundRelayServiceClass {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private _active = false;

  get active() { return this._active; }

  // Start relay loop — safe to call multiple times
  async startRelay(): Promise<void> {
    if (this.timer) return; // already running

    console.log('[Relay] Starting background relay (30s interval)');
    this._active = true;

    // Try immediately, then every 30s
    await this._tryRelay();
    this.timer = setInterval(() => { this._tryRelay(); }, 30_000);
  }

  stopRelay(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._active = false;
    console.log('[Relay] Stopped');
  }

  // Force an immediate relay attempt (e.g. when screen comes to focus)
  async forceRelay(): Promise<void> {
    await this._tryRelay();
  }

  // Pending packet count
  async getPendingCount(): Promise<number> {
    const raw = await AsyncStorage.getItem('ble_relay_queue');
    if (!raw) return 0;
    return (JSON.parse(raw) as any[]).length;
  }

  private async _tryRelay(): Promise<void> {
    if (this.running) return;
    if (!bleMeshService.ready) return;

    this.running = true;
    try {
      const raw = await AsyncStorage.getItem('ble_relay_queue');
      if (!raw) return;
      const queue: any[] = JSON.parse(raw);
      if (!queue.length) return;

      console.log('[Relay] Attempting to relay', queue.length, 'packet(s)...');
      // broadcast() will send to all currently connected peers
      await bleMeshService.broadcast(queue[0]);
    } catch (e) {
      console.warn('[Relay] Error:', (e as any)?.message);
    } finally {
      this.running = false;
    }
  }
}

export const bleBackgroundRelayService = new BLEBackgroundRelayServiceClass();
export default bleBackgroundRelayService;
