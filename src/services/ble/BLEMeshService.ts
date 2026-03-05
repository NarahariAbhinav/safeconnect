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
    public _peerCount: number = 0;  // Tracks nearby connected peers
    private connectedDevices: Set<string> = new Set();  // Track connected device IDs

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
    getPeerCount(): number { return this._peerCount; }

    // ── Broadcast a packet (Peripheral/Advertising via GATT characteristic)
    // Note: react-native-ble-plx is Central-only on Android.
    // We simulate "advertising" by writing to connected devices we discover.
    //
    // TRUE advertising requires a separate peripheral library.
    // For the MVP demo: we use scan → connect → write pattern (Central → Central relay)
    async broadcast(pkt: MeshPacket): Promise<void> {
        if (!this._ready) return;
        await this._enqueueRelay(pkt);
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


    // ── Internal: scan for SafeConnect GATT service, connect, read packet ──
    private _scan(): void {
        this.manager!.startDeviceScan(
            [SC_SERVICE_UUID],   // only match SafeConnect devices
            { allowDuplicates: false },
            async (error, device) => {
                if (error) {
                    console.warn('[BLE] Scan error:', error.message);
                    // Restart scan on transient errors
                    setTimeout(() => this._scan(), 5000);
                    return;
                }
                if (!device) return;
                console.log('[BLE] Found device:', device.id, device.name ?? 'unnamed');
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
            const connected = await device.connect({ timeout: 8000 });
            
            // Track this device as connected
            this.connectedDevices.add(device.id);
            this._peerCount = this.connectedDevices.size;
            console.log(`[BLE] Connected to peer ${device.id}. Total peers: ${this._peerCount}`);

            await connected.discoverAllServicesAndCharacteristics();

            const chars: Characteristic[] = await connected.characteristicsForService(SC_SERVICE_UUID);
            const char = chars.find(c => c.uuid.toLowerCase() === SC_CHAR_UUID.toLowerCase());
            if (!char) {
                await connected.cancelConnection();
                // Remove from tracking
                this.connectedDevices.delete(device.id);
                this._peerCount = this.connectedDevices.size;
                return;
            }

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
            
            // Remove from tracking after disconnect
            this.connectedDevices.delete(device.id);
            this._peerCount = this.connectedDevices.size;
            
            await this._handleIncoming(pkt);
        } catch (e: any) {
            // Connection errors are common in BLE — just log and move on
            console.log('[BLE] Connection error for', device.id, ':', e?.message ?? e);
            // Clean up tracking on error
            this.connectedDevices.delete(device.id);
            this._peerCount = this.connectedDevices.size;
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
        // Keep only last 200 IDs
        if (seen.length > 200) seen.splice(0, seen.length - 200);
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
            // Keep max 50 packets
            if (queue.length > 50) queue.splice(0, queue.length - 50);
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
        this.manager?.destroy();
        this.manager = null;
        this._ready = false;
        this.listeners = [];
    }
}

export const bleMeshService = new BLEMeshServiceClass();
export default bleMeshService;
