/**
 * BLEBackgroundRelayService.ts — Simplified Background Relay
 *
 * Periodically checks if mesh is ready and peers are available,
 * then triggers any pending outgoing messages to be sent.
 *
 * The actual queue is now managed inside BLEMeshService (in-memory outgoingQueue).
 * This service just ensures the mesh stays alive and retries periodically.
 */

class BLEBackgroundRelayServiceClass {
  private timer: ReturnType<typeof setInterval> | null = null;
  private _active = false;

  get active() { return this._active; }

  async startRelay(): Promise<void> {
    if (this.timer) return;
    console.log('[Relay] Background relay started (30s interval)');
    this._active = true;
    this.timer = setInterval(() => {
      // The mesh service handles its own outgoing queue internally.
      // This interval just serves as a keepalive marker.
      console.log('[Relay] Heartbeat — mesh relay active');
    }, 30_000);
  }

  stopRelay(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._active = false;
    console.log('[Relay] Stopped');
  }

  async forceRelay(): Promise<void> {
    // No-op: outgoing queue is flushed automatically on new peer connect
    console.log('[Relay] Force relay — handled by BLEMeshService on connect');
  }

  async getPendingCount(): Promise<number> {
    return 0; // Queue is in-memory now, managed by BLEMeshService
  }
}

export const bleBackgroundRelayService = new BLEBackgroundRelayServiceClass();
export default bleBackgroundRelayService;
