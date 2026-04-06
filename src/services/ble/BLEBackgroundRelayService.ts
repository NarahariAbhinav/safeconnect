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
import { meshChatHelper } from './MeshChatHelper';

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

    this.running = true;
    try {
      // 1. Drain the raw packet queue (ble_relay_queue) — only send when mesh is ready and peers exist
      if (bleMeshService.ready && bleMeshService.getPeerCount() > 0) {
        const raw = await AsyncStorage.getItem('ble_relay_queue');
        if (raw) {
          const queue: any[] = JSON.parse(raw);
          if (queue.length) {
            const now = Date.now();
            const validQueue = queue.filter(p => p.ttl > now);

            // Cleanup expired packets
            if (validQueue.length !== queue.length) {
              await AsyncStorage.setItem('ble_relay_queue', JSON.stringify(validQueue));
            }

            if (validQueue.length) {
              console.log('[Relay] Attempting to relay', validQueue.length, 'packet(s)...');
              // Broadcast up to 5 most recent packets to avoid flooding
              for (const pkt of validQueue.slice(-5)) {
                await bleMeshService.broadcast(pkt);
                await new Promise(r => setTimeout(r, 100));
              }
            }
          }
        }
      }

      // 2. Also drain MeshChatHelper queue (mesh_chat_pending)
      // This queue stores chat messages at a higher level for retry
      await meshChatHelper.relayPendingMessages();
    } catch (e) {
      console.warn('[Relay] Error:', (e as any)?.message);
    } finally {
      this.running = false;
    }
  }
}

export const bleBackgroundRelayService = new BLEBackgroundRelayServiceClass();
export default bleBackgroundRelayService;
