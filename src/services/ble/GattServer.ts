/**
 * GattServer.ts — TypeScript wrapper for the native GattServerModule
 *
 * Provides a clean API for starting/stopping the BLE GATT server
 * and listening for incoming packets from other SafeConnect devices.
 *
 * Usage:
 *   await gattServer.start();
 *   gattServer.onPacketReceived((base64Data, deviceId) => { ... });
 *   await gattServer.setPayload(base64EncodedPacket);
 *   await gattServer.stop();
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const { GattServerModule } = NativeModules;

type PacketHandler = (data: string, deviceId: string) => void;
type PeerHandler = (deviceId: string, peerCount: number) => void;

class GattServerClass {
    private emitter: NativeEventEmitter | null = null;
    private packetHandlers: PacketHandler[] = [];
    private peerConnectHandlers: PeerHandler[] = [];
    private peerDisconnectHandlers: PeerHandler[] = [];
    private subscriptions: any[] = [];
    private _running = false;

    get available(): boolean {
        return Platform.OS === 'android' && GattServerModule != null;
    }

    get running(): boolean {
        return this._running;
    }

    /**
     * Start the GATT server and BLE advertising.
     * Returns: 'advertising' | 'server_only' (if advertising not supported)
     */
    async start(): Promise<string> {
        if (!this.available) {
            console.warn('[GattServer] Not available (iOS or module not linked)');
            return 'unavailable';
        }

        if (this._running) {
            console.log('[GattServer] Already running');
            return 'already_running';
        }

        try {
            const result = await GattServerModule.startServer();
            this._running = true;
            this._setupListeners();
            console.log('[GattServer] Started:', result);
            return result;
        } catch (e: any) {
            console.error('[GattServer] Start failed:', e?.message ?? e);
            throw e;
        }
    }

    /**
     * Stop the GATT server and advertising.
     */
    async stop(): Promise<void> {
        if (!this.available || !this._running) return;

        try {
            await GattServerModule.stopServer();
            this._running = false;
            this._removeListeners();
            console.log('[GattServer] Stopped');
        } catch (e: any) {
            console.error('[GattServer] Stop failed:', e?.message ?? e);
        }
    }

    /**
     * Update the payload served to scanning devices.
     * @param base64Data Base64 encoded JSON mesh packet
     */
    async setPayload(base64Data: string): Promise<void> {
        if (!this.available || !this._running) return;
        try {
            await GattServerModule.setPayload(base64Data);
        } catch (e: any) {
            console.warn('[GattServer] setPayload failed:', e?.message);
        }
    }

    /**
     * Get count of currently connected peer devices.
     */
    async getConnectedCount(): Promise<number> {
        if (!this.available || !this._running) return 0;
        try {
            return await GattServerModule.getConnectedCount();
        } catch {
            return 0;
        }
    }

    /**
     * Register a handler for incoming packets written by remote devices.
     * @param handler Receives (base64Data, deviceId)
     */
    onPacketReceived(handler: PacketHandler): void {
        this.packetHandlers.push(handler);
    }

    /**
     * Register a handler for peer connection events.
     */
    onPeerConnected(handler: PeerHandler): void {
        this.peerConnectHandlers.push(handler);
    }

    /**
     * Register a handler for peer disconnection events.
     */
    onPeerDisconnected(handler: PeerHandler): void {
        this.peerDisconnectHandlers.push(handler);
    }

    /**
     * Remove all handlers.
     */
    removeAllHandlers(): void {
        this.packetHandlers = [];
        this.peerConnectHandlers = [];
        this.peerDisconnectHandlers = [];
    }

    // ─── Internal ────────────────────────────────────────────────

    private _setupListeners(): void {
        if (!GattServerModule) return;

        this.emitter = new NativeEventEmitter(GattServerModule);

        const packetSub = this.emitter.addListener('onPacketReceived', (event: any) => {
            const { data, deviceId } = event;
            this.packetHandlers.forEach(h => {
                try { h(data, deviceId); }
                catch (e) { console.warn('[GattServer] Handler error:', e); }
            });
        });

        const connectSub = this.emitter.addListener('onPeerConnected', (event: any) => {
            const { deviceId, peerCount } = event;
            this.peerConnectHandlers.forEach(h => {
                try { h(deviceId, peerCount); }
                catch (e) { console.warn('[GattServer] Handler error:', e); }
            });
        });

        const disconnectSub = this.emitter.addListener('onPeerDisconnected', (event: any) => {
            const { deviceId, peerCount } = event;
            this.peerDisconnectHandlers.forEach(h => {
                try { h(deviceId, peerCount); }
                catch (e) { console.warn('[GattServer] Handler error:', e); }
            });
        });

        this.subscriptions = [packetSub, connectSub, disconnectSub];
    }

    private _removeListeners(): void {
        for (const sub of this.subscriptions) {
            sub?.remove?.();
        }
        this.subscriptions = [];
        this.emitter = null;
    }
}

export const gattServer = new GattServerClass();
export default gattServer;
