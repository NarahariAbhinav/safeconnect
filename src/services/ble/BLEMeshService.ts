/**
 * BLEMeshService.ts — Core BLE Mesh for SafeConnect
 *
 * Architecture: Each phone plays BOTH roles simultaneously:
 *
 *  ┌──────────────────────────────────────┐
 *  │  PERIPHERAL (Advertise / Server)     │  ← "I have messages"
 *  │  GATT Server broadcasts SOS packets  │
 *  └──────────────────────────────────────┘
 *            ↕ BLE ~100m
 *  ┌──────────────────────────────────────┐
 *  │  CENTRAL (Scan / Client)             │  ← "I'm listening"
 *  │  Discovers nearby SafeConnect nodes  │
 *  │  Reads their payloads                │
 *  │  Stores + re-broadcasts forward      │
 *  └──────────────────────────────────────┘
 *
 * Message Flow (Offline DTN):
 *   SOS activated → BLE broadcast → relay hops → Gateway node → Firebase
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BleManager, Characteristic, Device, State } from 'react-native-ble-plx';
import { chatService } from '../chatService';
import { GovtAction, sosService } from '../sos';
import { gattServer } from './GattServer';

// ─── SafeConnect BLE Identity (fixed UUIDs so all devices recognise each other)
export const SC_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const SC_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

// ─── Packet structure (JSON serialised, max 512 bytes per BLE write)
export interface MeshPacket {
    id: string;          // unique packet ID (used for deduplication)
    type: 'sos' | 'needs' | 'resource' | 'ping' | 'govtAction' | 'chat';
    payload: string;          // JSON stringified SOSRecord / NeedsReport / GovtAction / ChatMsg
    origin: string;          // userId who originally sent this
    hops: number;          // incremented each relay hop (max 5)
    ttl: number;          // unix ms timestamp — drop packet after this
    createdAt: number;
}

const MAX_HOPS = 5;
const TTL_MS = 12 * 60 * 60 * 1000;  // 12 hours
const SCAN_TIMEOUT = 30_000;                 // 30s scan window
const KEY_SEEN = 'ble_seen_packets';    // dedup store
const KEY_QUEUE = 'ble_relay_queue';     // packets waiting to re-broadcast

class BLEMeshServiceClass {
    private manager: BleManager | null = null;
    private isScanning: boolean = false;
    private listeners: ((pkt: MeshPacket) => void)[] = [];
    private _ready: boolean = false;
    public _peerCount: number = 0;
    private connectedDevices: Set<string> = new Set();
    // Track discovered peers with timestamps for TTL-based peer count
    private discoveredPeers: Map<string, number> = new Map();
    private static PEER_TTL_MS = 120_000;  // Peer expires after 2 minutes of no contact

    // ── Init ──────────────────────────────────────────────────────────────
    async init(): Promise<boolean> {
        try {
            this.manager = new BleManager();
            console.log('[BLE] Manager created, waiting for Bluetooth state...');

            return new Promise<boolean>(resolve => {
                const timeoutId = setTimeout(() => {
                    console.warn('[BLE] Init timeout — Bluetooth may be disabled or permissions not granted');
                    resolve(false);
                }, 10000);

                const sub = this.manager!.onStateChange(state => {
                    console.log('[BLE] Bluetooth state changed:', state);
                    if (state === State.PoweredOn) {
                        clearTimeout(timeoutId);
                        sub.remove();
                        this._ready = true;
                        console.log('[BLE] ✅ Ready - Bluetooth is ON');

                        // Start native GATT server so other phones can discover us
                        this._startGattServer();

                        resolve(true);
                    } else if (state === State.PoweredOff) {
                        clearTimeout(timeoutId);
                        sub.remove();
                        console.warn('[BLE] ❌ Bluetooth is OFF — user needs to enable it');
                        resolve(false);
                    } else if (state === State.Unauthorized) {
                        clearTimeout(timeoutId);
                        sub.remove();
                        console.warn('[BLE] ❌ Bluetooth permissions not granted');
                        resolve(false);
                    } else if (state === State.Unknown) {
                        console.warn('[BLE] ⏳ Bluetooth state unknown — waiting...');
                    }
                }, true);
            });
        } catch (e) {
            console.error('[BLE] Fatal error during init:', e);
            return false;
        }
    }

    get ready() { return this._ready; }
    getPeerCount(): number {
        // Clean up expired peers and return accurate count
        const now = Date.now();
        for (const [id, ts] of this.discoveredPeers) {
            if (now - ts > BLEMeshServiceClass.PEER_TTL_MS) {
                this.discoveredPeers.delete(id);
            }
        }
        this._peerCount = this.discoveredPeers.size;
        return this._peerCount;
    }

    // ── Broadcast a packet (now uses BOTH Central writes AND Peripheral GATT server)
    // 1. Enqueue to relay queue for Central→Central push
    // 2. Update GATT server payload so scanning devices can READ from us
    // 3. Scan and write to nearby devices (Central role)
    async broadcast(pkt: MeshPacket): Promise<void> {
        if (!this._ready) return;
        await this._enqueueRelay(pkt);

        // Update GATT server characteristic so other scanning devices can read this packet
        if (gattServer.running) {
            try {
                const jsonStr = JSON.stringify(pkt);
                // Convert to Base64 for the native module
                const base64 = this._toBase64(jsonStr);
                await gattServer.setPayload(base64);
                console.log('[BLE] GATT server payload updated for broadcast');
            } catch (e) {
                console.warn('[BLE] Failed to update GATT payload:', e);
            }
        }

        await this._scanAndRelay();
    }

    // ── Start continuous scanning (call once on app launch when SOS is active)
    async startScanning(onPacket?: (pkt: MeshPacket) => void): Promise<void> {
        if (!this._ready || this.isScanning) return;
        if (onPacket) this.listeners.push(onPacket);
        this.isScanning = true;
        console.log('[BLE] Scanning started...');
        this._scan();
    }

    stopScanning(): void {
        this.manager?.stopDeviceScan();
        this.isScanning = false;
        console.log('[BLE] Scanning stopped');
    }

    // ── Public listener management ─────────────────────────────────────────
    addListener(cb: (pkt: MeshPacket) => void): void {
        if (!this.listeners.includes(cb)) this.listeners.push(cb);
    }

    removeListener(cb: (pkt: MeshPacket) => void): void {
        this.listeners = this.listeners.filter(l => l !== cb);
    }


    // ── Internal: scan for nearby BLE devices, connect and check for SafeConnect service ──
    // Note: We scan WITHOUT UUID filter because react-native-ble-plx is Central-only
    // and other SafeConnect devices cannot advertise the service UUID.
    // Instead we scan for all devices, connect, and check if they have our service.
    private _scan(): void {
        const triedDevices = new Set<string>();  // Avoid re-trying same device in one scan window

        this.manager!.startDeviceScan(
            null,   // scan ALL BLE devices (Central-only mode — no device advertises our UUID)
            { allowDuplicates: false },
            async (error, device) => {
                if (error) {
                    console.warn('[BLE] Scan error:', error.message);
                    setTimeout(() => this._scan(), 5000);
                    return;
                }
                if (!device || !device.id) return;
                // Skip devices we already tried this scan window
                if (triedDevices.has(device.id)) return;
                triedDevices.add(device.id);

                // Log discovery (useful for debugging)
                const name = device.name || device.localName || 'unnamed';
                console.log('[BLE] Discovered device:', device.id, name);

                // Track as a nearby peer (even before verifying SafeConnect service)
                this.discoveredPeers.set(device.id, Date.now());
                this._peerCount = this.discoveredPeers.size;

                // Try to connect and check for SafeConnect service
                await this._connectAndRead(device);
            }
        );

        // Auto-restart scan after SCAN_TIMEOUT
        setTimeout(() => {
            if (this.isScanning) {
                this.manager?.stopDeviceScan();
                console.log('[BLE] Restarting scan window...');
                this._scan();
            }
        }, SCAN_TIMEOUT);
    }

    private async _connectAndRead(device: Device): Promise<void> {
        try {
            const connected = await device.connect({ timeout: 5000 });
            this.connectedDevices.add(device.id);
            console.log(`[BLE] Connected to peer ${device.id}`);

            await connected.discoverAllServicesAndCharacteristics();

            // Check if this device has the SafeConnect service
            let chars: Characteristic[];
            try {
                chars = await connected.characteristicsForService(SC_SERVICE_UUID);
            } catch {
                // Not a SafeConnect device — disconnect quietly
                await connected.cancelConnection();
                this.connectedDevices.delete(device.id);
                return;
            }
            const char = chars.find(c => c.uuid.toLowerCase() === SC_CHAR_UUID.toLowerCase());
            if (!char) {
                await connected.cancelConnection();
                this.connectedDevices.delete(device.id);
                return;
            }

            // Confirmed SafeConnect peer — update tracking with fresh timestamp
            this.discoveredPeers.set(device.id, Date.now());
            this._peerCount = this.discoveredPeers.size;
            console.log(`[BLE] ✅ SafeConnect peer confirmed: ${device.id}. Peers: ${this._peerCount}`);

            // Read the characteristic value (Base64 encoded JSON)
            const read = await char.read();
            if (!read.value) { 
                await connected.cancelConnection();
                this.connectedDevices.delete(device.id);
                this._peerCount = this.connectedDevices.size;
                return;
            }

            const raw = Buffer.from(read.value, 'base64').toString('utf8');
            const pkt: MeshPacket = JSON.parse(raw);

            // Also write any queued relay packets back to this node
            // (bidirectional exchange)
            const queue = await this._getRelayQueue();
            for (const relayPkt of queue.slice(0, 3)) {   // max 3 packets per connection
                const encoded = Buffer.from(JSON.stringify(relayPkt)).toString('base64');
                await char.writeWithoutResponse(encoded);
            }

            await connected.cancelConnection();
            this.connectedDevices.delete(device.id);
            // Don't reset _peerCount here — discoveredPeers map tracks with TTL
            
            await this._handleIncoming(pkt);
        } catch (e: any) {
            // Connection errors are common in BLE — just log and move on
            console.log('[BLE] Connection error for', device.id, ':', e?.message ?? e);
            this.connectedDevices.delete(device.id);
        }
    }

    // ── Process an incoming packet ─────────────────────────────────────────
    private async _handleIncoming(pkt: MeshPacket): Promise<void> {
        // 1. Deduplication — have we seen this packet before?
        if (await this._isSeen(pkt.id)) {
            console.log('[BLE] Duplicate packet ignored:', pkt.id);
            return;
        }
        // 2. TTL check — has it expired?
        if (Date.now() > pkt.ttl) {
            console.log('[BLE] Expired packet dropped:', pkt.id);
            return;
        }
        // 3. Max hops check
        if (pkt.hops >= MAX_HOPS) {
            console.log('[BLE] Max hops reached:', pkt.id);
            return;
        }

        console.log('[BLE] New packet received:', pkt.type, 'from', pkt.origin);
        await this._markSeen(pkt.id);

        // 4. Handle specific packet types locally
        await this._processPacketLocally(pkt);

        // 5. Notify listeners (SOSScreen, HomeScreen etc.)
        this.listeners.forEach(cb => cb(pkt));

        // 6. Try to sync to Firebase immediately (Gateway pattern)
        const synced = await this._tryGatewaySync(pkt);
        console.log('[BLE] Gateway sync:', synced ? 'uploaded ✅' : 'queued for relay');

        // 7. If not synced, relay to more devices
        if (!synced) {
            const relay: MeshPacket = { ...pkt, hops: pkt.hops + 1 };
            await this._enqueueRelay(relay);
        }
    }

    // ── Process packet locally (store govtAction / chat on THIS device) ────
    private async _processPacketLocally(pkt: MeshPacket): Promise<void> {
        try {
            const data = JSON.parse(pkt.payload);

            if (pkt.type === 'govtAction') {
                // Govt dispatched rescue — cache it locally so SOSScreen shows banner
                const action = data as GovtAction;
                await sosService.storeGovtActionFromMesh(action);
                console.log('[BLE] GovtAction stored locally for SOS:', action.sosId);
            }

            if (pkt.type === 'chat') {
                // Incoming chat message via BLE mesh — store locally
                const { roomId, message } = data;
                if (roomId && message) {
                    const KEY = `chat_messages_${roomId}`;
                    const raw = await AsyncStorage.getItem(KEY);
                    const msgs = raw ? JSON.parse(raw) : [];
                    if (!msgs.find((m: any) => m.id === message.id)) {
                        msgs.push({ ...message, status: 'delivered' });
                        msgs.sort((a: any, b: any) => a.createdAt - b.createdAt);
                        await AsyncStorage.setItem(KEY, JSON.stringify(msgs));
                        console.log('[BLE] Chat message stored locally:', message.id);
                    }
                }
            }
        } catch (e) {
            // Payload parse error — not critical
            console.log('[BLE] Could not process packet locally:', (e as any)?.message);
        }
    }

    // ── Gateway: if internet available, upload to Firebase ────────────────
    private async _tryGatewaySync(pkt: MeshPacket): Promise<boolean> {
        try {
            const res = await fetch('https://www.google.com/generate_204', {
                method: 'HEAD', cache: 'no-cache',
            });
            if (!res.ok && res.status !== 204) return false;
        } catch {
            return false;   // No internet
        }

        // We have internet — flush SOS + needs + resources via sosService
        try {
            const { flushed } = await sosService.flushSyncQueue();
            console.log('[BLE→Gateway] Uploaded', flushed, 'SOS records to Firebase ✅');
        } catch { /* SOS sync failed */ }

        // Also sync pending chat messages
        try {
            const chatSynced = await chatService.syncPendingMessages();
            if (chatSynced > 0) console.log('[BLE→Gateway] Synced', chatSynced, 'chat messages ✅');
        } catch { /* Chat sync failed */ }

        return true;
    }

    // ── Scan once and write all queued relay packets to nearby devices ─────
    private async _scanAndRelay(): Promise<void> {
        return new Promise(resolve => {
            let found = 0;
            this.manager!.startDeviceScan([SC_SERVICE_UUID], { allowDuplicates: false },
                async (error, device) => {
                    if (error || !device) return;
                    found++;
                    await this._writeRelayQueue(device);
                    if (found >= 5) {
                        this.manager?.stopDeviceScan();
                        resolve();
                    }
                }
            );
            setTimeout(() => {
                this.manager?.stopDeviceScan();
                resolve();
            }, 10_000);
        });
    }

    private async _writeRelayQueue(device: Device): Promise<void> {
        try {
            const conn = await device.connect({ timeout: 6000 });
            await conn.discoverAllServicesAndCharacteristics();
            const chars = await conn.characteristicsForService(SC_SERVICE_UUID);
            const char = chars.find(c => c.uuid.toLowerCase() === SC_CHAR_UUID.toLowerCase());
            if (!char) { await conn.cancelConnection(); return; }

            const queue = await this._getRelayQueue();
            for (const pkt of queue.slice(0, 5)) {
                const encoded = Buffer.from(JSON.stringify(pkt)).toString('base64');
                await char.writeWithoutResponse(encoded);
            }
            await conn.cancelConnection();
        } catch { /* Connection failed — try next device */ }
    }

    // ── Deduplication helpers ─────────────────────────────────────────────
    private async _isSeen(id: string): Promise<boolean> {
        const raw = await AsyncStorage.getItem(KEY_SEEN);
        const seen: string[] = raw ? JSON.parse(raw) : [];
        return seen.includes(id);
    }

    private async _markSeen(id: string): Promise<void> {
        const raw = await AsyncStorage.getItem(KEY_SEEN);
        const seen: string[] = raw ? JSON.parse(raw) : [];
        seen.push(id);
        // Keep only last 500 IDs
        if (seen.length > 500) seen.splice(0, seen.length - 500);
        await AsyncStorage.setItem(KEY_SEEN, JSON.stringify(seen));
    }

    // ── Relay queue ───────────────────────────────────────────────────────
    private async _getRelayQueue(): Promise<MeshPacket[]> {
        const raw = await AsyncStorage.getItem(KEY_QUEUE);
        return raw ? JSON.parse(raw) : [];
    }

    private async _enqueueRelay(pkt: MeshPacket): Promise<void> {
        const queue = await this._getRelayQueue();
        if (!queue.find(p => p.id === pkt.id)) {
            queue.push(pkt);
            // Keep max 100 packets
            if (queue.length > 100) queue.splice(0, queue.length - 100);
            await AsyncStorage.setItem(KEY_QUEUE, JSON.stringify(queue));
        }
    }

    // ── Public helpers: create mesh packets ─────────────────────────────────
    createSOSPacket(userId: string, payload: object): MeshPacket {
        return {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'sos',
            payload: JSON.stringify(payload),
            origin: userId,
            hops: 0,
            ttl: Date.now() + TTL_MS,
            createdAt: Date.now(),
        };
    }

    createGovtActionPacket(action: GovtAction): MeshPacket {
        return {
            id: `ga_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'govtAction',
            payload: JSON.stringify(action),
            origin: 'govt_eoc',
            hops: 0,
            ttl: Date.now() + TTL_MS,
            createdAt: Date.now(),
        };
    }

    createChatPacket(userId: string, roomId: string, message: object): MeshPacket {
        return {
            id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'chat',
            payload: JSON.stringify({ roomId, message }),
            origin: userId,
            hops: 0,
            ttl: Date.now() + TTL_MS,
            createdAt: Date.now(),
        };
    }

    destroy(): void {
        this.stopScanning();
        // Stop GATT server
        gattServer.stop().catch(() => {});
        gattServer.removeAllHandlers();
        this.manager?.destroy();
        this.manager = null;
        this._ready = false;
        this.listeners = [];
        this.discoveredPeers.clear();
    }

    // ── Start native GATT server (Peripheral role) ─────────────────────
    private async _startGattServer(): Promise<void> {
        if (!gattServer.available) {
            console.log('[BLE] GATT server not available (non-Android or module not linked)');
            return;
        }

        try {
            const result = await gattServer.start();
            console.log('[BLE] GATT server started:', result);

            // Listen for incoming packets written by other devices
            gattServer.onPacketReceived(async (base64Data: string, deviceId: string) => {
                try {
                    const jsonStr = this._fromBase64(base64Data);
                    const pkt: MeshPacket = JSON.parse(jsonStr);
                    console.log('[BLE] 📥 Packet received via GATT server from', deviceId, '- type:', pkt.type);

                    // Track this device as a peer
                    this.discoveredPeers.set(deviceId, Date.now());
                    this._peerCount = this.discoveredPeers.size;

                    // Process the incoming packet (dedup, relay, notify listeners)
                    await this._handleIncoming(pkt);
                } catch (e) {
                    console.warn('[BLE] Failed to parse GATT server packet:', e);
                }
            });

            // Track peer connections from the GATT server
            gattServer.onPeerConnected((deviceId: string, count: number) => {
                this.discoveredPeers.set(deviceId, Date.now());
                this._peerCount = this.discoveredPeers.size;
                console.log(`[BLE] GATT peer connected: ${deviceId} (${count} via server)`);
            });

            gattServer.onPeerDisconnected((deviceId: string, _count: number) => {
                // Don't remove immediately — let TTL handle expiry
                console.log(`[BLE] GATT peer disconnected: ${deviceId}`);
            });

        } catch (e) {
            console.warn('[BLE] GATT server start failed:', e);
        }
    }

    // ── Base64 helpers (works without Buffer polyfill) ──────────────────
    private _toBase64(str: string): string {
        // Use a simple approach that works in React Native
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch {
            // Fallback: use Buffer if available
            return Buffer.from(str, 'utf8').toString('base64');
        }
    }

    private _fromBase64(base64: string): string {
        try {
            return decodeURIComponent(escape(atob(base64)));
        } catch {
            return Buffer.from(base64, 'base64').toString('utf8');
        }
    }
}

export const bleMeshService = new BLEMeshServiceClass();
export default bleMeshService;
