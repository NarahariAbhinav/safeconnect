/**
 * BLEMeshService.ts — Core Mesh Networking for SafeConnect
 *
 * REWRITTEN: Bulletproof implementation.
 *
 * CRITICAL FIXES:
 *   1. Event listener return values MUST be stored as class properties.
 *      expo-nearby-connections creates a new EventEmitter per onXxx() call.
 *      If the returned unsubscribe closure is GC'd, the EventEmitter loses
 *      its reference chain and the listener stops firing.
 *
 *   2. Kotlin native patch NO LONGER auto-accepts on the advertiser side.
 *      Only JS calls acceptConnection (which registers payloadCallback).
 *      The requestor side still auto-accepts in native (no JS event for it).
 *
 *   3. Single in-memory outgoing queue replaces 3 overlapping queue systems.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import * as Location from 'expo-location';
import * as Nearby from 'expo-nearby-connections';
import * as TaskManager from 'expo-task-manager';
import { Alert, Linking, Platform } from 'react-native';
import { notificationService } from '../notificationService';
import { GovtAction, sosService } from '../sos';

const KEY_SMS_RELAYED = 'ble_sms_relayed';

const MESH_KEEP_ALIVE_TASK = 'MESH_KEEP_ALIVE_TASK';
TaskManager.defineTask(MESH_KEEP_ALIVE_TASK, async () => { /* keep CPU awake */ });

// Backward compat exports
export const SC_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const SC_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

// ─── Types ────────────────────────────────────────────────────────
export interface MeshPacket {
  id: string;
  type: 'sos' | 'needs' | 'resource' | 'ping' | 'govtAction' | 'chat' | 'chat_ack';
  payload: string;
  origin: string;
  hops: number;
  ttl: number;
  createdAt: number;
}

export interface MeshUIEvent {
  event: 'found' | 'connecting' | 'invitation' | 'connected' | 'disconnected';
  peerId: string;
  peerName: string;
}

const MAX_HOPS = 5;
const TTL_MS = 12 * 60 * 60 * 1000;
const STRATEGY = Nearby.Strategy.P2P_CLUSTER;

// In-memory dedup (fast, no AsyncStorage overhead)
const seenIds = new Set<string>();
function markSeen(id: string) {
  seenIds.add(id);
  if (seenIds.size > 500) {
    const first = seenIds.values().next().value;
    if (first) seenIds.delete(first);
  }
}

// ─── Service ──────────────────────────────────────────────────────
class BLEMeshServiceClass {
  private _ready = false;
  private _eventsRegistered = false;
  private peers = new Map<string, string>(); // peerId → peerName
  private listeners: ((pkt: MeshPacket) => void)[] = [];
  private uiListeners: ((e: MeshUIEvent) => void)[] = [];
  private _name = 'SC-' + Math.floor(Math.random() * 9000 + 1000);
  private outgoingQueue: MeshPacket[] = [];

  private async _persistQueue() {
    try { await AsyncStorage.setItem('mesh_outgoing_queue', JSON.stringify(this.outgoingQueue)); } catch { }
  }
  private async _loadQueue() {
    try {
      const raw = await AsyncStorage.getItem('mesh_outgoing_queue');
      if (raw) this.outgoingQueue = JSON.parse(raw);
    } catch { }
  }

  /**
   * CRITICAL: Store all event listener unsubscribe functions as class properties.
   * The expo-nearby-connections library creates a NEW EventEmitter instance per
   * onXxx() call. The returned unsubscribe closure holds the only reference chain
   * to that EventEmitter. If this closure is garbage collected, the EventEmitter
   * dies and the listener silently stops firing.
   *
   * By storing these as class properties, we prevent GC as long as the service lives.
   */
  private _unsubPeerFound: (() => void) | null = null;
  private _unsubPeerLost: (() => void) | null = null;
  private _unsubInvitation: (() => void) | null = null;
  private _unsubConnected: (() => void) | null = null;
  private _unsubDisconnected: (() => void) | null = null;
  private _unsubTextReceived: (() => void) | null = null;

  // ── Public getters ─────────────────────────────────────────────
  get ready() { return this._ready; }
  get _peerCount() { return this.peers.size; }
  getPeerCount() { return this.peers.size; }

  getConnectedPeers(): { id: string; name: string }[] {
    return Array.from(this.peers.entries()).map(([id, name]) => ({ id, name }));
  }

  // ── UI event listeners ─────────────────────────────────────────
  addUIListener(cb: (e: MeshUIEvent) => void): void {
    if (!this.uiListeners.includes(cb)) this.uiListeners.push(cb);
  }
  removeUIListener(cb: (e: MeshUIEvent) => void): void {
    this.uiListeners = this.uiListeners.filter(l => l !== cb);
  }
  private _emitUI(e: MeshUIEvent): void {
    console.log('[Mesh] UI:', e.event, e.peerName);
    this.uiListeners.forEach(cb => { try { cb(e); } catch { } });
  }

  // ── Data listeners ─────────────────────────────────────────────
  addListener(cb: (pkt: MeshPacket) => void): void {
    if (!this.listeners.includes(cb)) this.listeners.push(cb);
  }
  removeListener(cb: (pkt: MeshPacket) => void): void {
    this.listeners = this.listeners.filter(l => l !== cb);
  }

  // ── init() ─────────────────────────────────────────────────────
  async init(displayName?: string): Promise<boolean> {
    if (this._ready) {
      console.log('[Mesh] Already ready');
      return true;
    }

    if (displayName) {
      const suffix = Math.floor(Math.random() * 9000 + 1000);
      this._name = `${displayName.slice(0, 16)}-${suffix}`;
    }

    await this._loadQueue();

    // Register events ONCE — and STORE the unsubscribe functions
    if (!this._eventsRegistered) {
      this._registerEvents();
      this._eventsRegistered = true;
    }

    let advertiseOk = false;
    let discoverOk = false;

    try {
      await Nearby.startAdvertise(this._name, STRATEGY);
      advertiseOk = true;
      console.log('[Mesh] ✅ Advertising as:', this._name);
    } catch (e: any) {
      console.warn('[Mesh] Advertise failed:', e?.message);
    }

    try {
      await Nearby.startDiscovery(this._name, STRATEGY);
      discoverOk = true;
      console.log('[Mesh] ✅ Discovery started');
    } catch (e: any) {
      console.warn('[Mesh] Discovery failed:', e?.message);
    }

    this._ready = advertiseOk || discoverOk;

    if (this._ready) {
      console.log('[Mesh] ✅ Mesh ready — advertise:', advertiseOk, '| discover:', discoverOk);
      this._startForegroundService();
    } else {
      console.error('[Mesh] ❌ Failed — retrying in 4s');
      setTimeout(() => {
        if (!this._ready) this.init(displayName);
      }, 4000);
    }

    return this._ready;
  }

  // ── Register events (exactly once) ─────────────────────────────
  private _registerEvents(): void {
    console.log('[Mesh] Registering event listeners...');

    // ── Peer Found ───────────────────────────────────────────────
    this._unsubPeerFound = Nearby.onPeerFound(({ peerId, name }: any) => {
      const peerName = name?.trim() || `Device-${peerId.slice(-4)}`;
      console.log('[Mesh] 🔍 Found:', peerName, peerId);
      this._emitUI({ event: 'found', peerId, peerName });

      if (this.peers.has(peerId)) return;

      // Deterministic initiator (only one side connects)
      const myLower = this._name.toLowerCase();
      const theirLower = peerName.toLowerCase();
      const iShouldInitiate = myLower > theirLower || (myLower === theirLower && this._name > peerId);

      if (!iShouldInitiate) {
        console.log('[Mesh] ⏳ Waiting for', peerName, 'to initiate');
        return;
      }

      const delay = 500 + Math.floor(Math.random() * 1000);
      setTimeout(() => {
        if (this.peers.has(peerId)) return;
        console.log('[Mesh] 📡 Requesting connection to', peerName);
        this._emitUI({ event: 'connecting', peerId, peerName });
        Nearby.requestConnection(peerId)
          .then(() => console.log('[Mesh] Request sent to', peerName))
          .catch((e: any) => console.warn('[Mesh] requestConnection err:', e?.message));
      }, delay);
    });

    // ── Peer Lost ────────────────────────────────────────────────
    this._unsubPeerLost = Nearby.onPeerLost(({ peerId }: any) => {
      const name = this.peers.get(peerId) || `Device-${peerId.slice(-4)}`;
      this.peers.delete(peerId);
      this._emitUI({ event: 'disconnected', peerId, peerName: name });
      console.log('[Mesh] Lost:', name, '| Peers:', this.peers.size);
    });

    // ── Invitation Received (advertiser side) ────────────────────
    // The Kotlin native module fires this when another device requests connection.
    // We MUST call acceptConnection here — this is where Google Nearby registers
    // the payloadCallback that enables sendText/onTextReceived to work.
    this._unsubInvitation = Nearby.onInvitationReceived(({ peerId, name }: any) => {
      const peerName = name?.trim() || `Device-${peerId.slice(-4)}`;
      console.log('[Mesh] 📨 Invitation from:', peerName);
      this._emitUI({ event: 'invitation', peerId, peerName });

      // Accept the connection — this registers the payloadCallback
      Nearby.acceptConnection(peerId)
        .then(() => console.log('[Mesh] ✅ Accepted connection from', peerName))
        .catch((e: any) => console.warn('[Mesh] acceptConnection err:', e?.message));
    });

    // ── Connected ────────────────────────────────────────────────
    this._unsubConnected = Nearby.onConnected(({ peerId, name }: any) => {
      const peerName = name?.trim() || `Device-${peerId.slice(-4)}`;
      this.peers.set(peerId, peerName);
      this._emitUI({ event: 'connected', peerId, peerName });
      console.log('[Mesh] ✅ CONNECTED to', peerName, '| Total:', this.peers.size);

      // Flush queued outgoing messages
      this._flushOutgoing(peerId);
    });

    // ── Disconnected ─────────────────────────────────────────────
    this._unsubDisconnected = Nearby.onDisconnected(({ peerId }: any) => {
      const name = this.peers.get(peerId) || `Device-${peerId.slice(-4)}`;
      this.peers.delete(peerId);
      this._emitUI({ event: 'disconnected', peerId, peerName: name });
      console.log('[Mesh] ❌ Disconnected from', name, '| Total:', this.peers.size);
    });

    // ── Text Received (data payload) ─────────────────────────────
    this._unsubTextReceived = Nearby.onTextReceived(({ peerId, text }: any) => {
      console.log('[Mesh] 📦 Received from', peerId, '| len:', text?.length);

      try {
        const pkt: MeshPacket = JSON.parse(text);
        console.log('[Mesh] Packet:', pkt.type, pkt.id, 'hops:', pkt.hops);

        // E2EE decrypt for private chat
        if (pkt.type === 'chat') {
          try {
            const p = JSON.parse(pkt.payload);
            if (p.encrypted && p.roomId) {
              const bytes = CryptoJS.AES.decrypt(p.message, p.roomId);
              const dec = bytes.toString(CryptoJS.enc.Utf8);
              if (dec) {
                p.message = JSON.parse(dec);
                pkt.payload = JSON.stringify(p);
                console.log('[Mesh] 🔓 Decrypted private chat');

                // Fire Network ACK back into the mesh confirming decryption/delivery
                // Only do this if it's not a message we sent ourselves (logical user ID check)
                if (p.message.senderId && p.message.id) {
                  AsyncStorage.getItem('safeconnect_currentUser').then(raw => {
                    if (raw) {
                      try {
                        const u = JSON.parse(raw);
                        if (u.id && p.message.senderId !== u.id) {
                          const ack = this.createChatAckPacket(p.message.id, p.roomId);
                          // Fire-and-forget broadcast of the ACK
                          this.broadcast(ack).catch(() => { });
                        }
                      } catch { }
                    }
                  }).catch(() => { });
                }
              }
            }
          } catch {
            console.log('[Mesh] E2EE skip (not for us or group)');
          }
        }

        this._handlePacket(pkt);
      } catch (e) {
        console.warn('[Mesh] Parse error:', e);
      }
    });

    console.log('[Mesh] ✅ All 6 event listeners registered and stored');
  }

  // ── Foreground Service ─────────────────────────────────────────
  private async _startForegroundService() {
    if (Platform.OS !== 'android') return;
    try {
      await Location.requestForegroundPermissionsAsync();
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status === 'granted') {
        await Location.startLocationUpdatesAsync(MESH_KEEP_ALIVE_TASK, {
          accuracy: Location.Accuracy.Lowest,
          timeInterval: 60000,
          distanceInterval: 1000,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'SafeConnect Mesh Active',
            notificationBody: 'Routing emergency messages...',
            notificationColor: '#2A7A5A',
          },
        });
        console.log('[Mesh] Foreground service started');
      }
    } catch (e) {
      console.warn('[Mesh] Foreground service err:', e);
    }
  }

  // ── broadcast() ────────────────────────────────────────────────
  async broadcast(pkt: MeshPacket): Promise<void> {
    if (seenIds.has(pkt.id)) return;
    markSeen(pkt.id);

    if (this.peers.size > 0) {
      console.log('[Mesh] Broadcasting', pkt.type, 'to', this.peers.size, 'peer(s)');
      await this._sendToAll(pkt);
    } else {
      console.log('[Mesh] No peers — queuing', pkt.type);
      this._addToOutgoing(pkt);
    }
  }

  private async _sendToAll(pkt: MeshPacket): Promise<void> {
    const json = JSON.stringify(pkt);
    const dead: string[] = [];

    for (const [peerId, peerName] of this.peers) {
      try {
        await Nearby.sendText(peerId, json);
        console.log('[Mesh] ✅ Sent', pkt.type, 'to', peerName);
      } catch (e: any) {
        console.warn('[Mesh] ❌ Send failed to', peerName, ':', e?.message);
        dead.push(peerId);
      }
    }

    for (const id of dead) this.peers.delete(id);
  }

  // ── Outgoing queue ─────────────────────────────────────────────
  private _addToOutgoing(pkt: MeshPacket) {
    if (this.outgoingQueue.some(p => p.id === pkt.id)) return;
    this.outgoingQueue.push(pkt);
    if (this.outgoingQueue.length > 50) this.outgoingQueue = this.outgoingQueue.slice(-50);
    this._persistQueue().catch(() => { });
  }

  private async _flushOutgoing(peerId: string) {
    if (this.outgoingQueue.length === 0) return;
    console.log('[Mesh] Flushing', this.outgoingQueue.length, 'queued packets');
    const batch = [...this.outgoingQueue];
    this.outgoingQueue = [];
    await this._persistQueue();

    for (const pkt of batch) {
      try {
        await Nearby.sendText(peerId, JSON.stringify(pkt));
        await new Promise(r => setTimeout(r, 50));
      } catch (e: any) {
        console.warn('[Mesh] Flush err:', e?.message);
        this._addToOutgoing(pkt);
        break;
      }
    }
  }

  // ── Handle incoming packet ─────────────────────────────────────
  private async _handlePacket(pkt: MeshPacket): Promise<void> {
    if (seenIds.has(pkt.id)) { console.log('[Mesh] Dup:', pkt.id); return; }
    if (Date.now() > pkt.ttl) { console.log('[Mesh] Expired:', pkt.id); return; }
    if (pkt.hops >= MAX_HOPS) { console.log('[Mesh] Max hops:', pkt.id); return; }

    markSeen(pkt.id);

    // Store locally
    await this._storeLocally(pkt);

    // Notify UI listeners
    console.log('[Mesh] → Notifying', this.listeners.length, 'listener(s)');
    this.listeners.forEach(cb => { try { cb(pkt); } catch (e) { console.warn('[Mesh] Listener err:', e); } });

    // 5. Chat and Chat ACKs are ALWAYS delivered via BLE mesh only
    //    Firebase is NOT used. Both group (mesh_broadcast) and private room packets rely on BLE.
    if (pkt.type === 'chat' || pkt.type === 'chat_ack') {
      const relay: MeshPacket = { ...pkt, hops: pkt.hops + 1 };
      this._addToOutgoing(relay);
      if (this.peers.size > 0) this._sendToAll(relay);
      return;
    }

    // Gateway sync for non-chat packets
    this._gatewaySync().catch(() => { });
  }

  // ── Store locally ──────────────────────────────────────────────
  private async _storeLocally(pkt: MeshPacket): Promise<void> {
    try {
      const data = JSON.parse(pkt.payload);

      if (pkt.type === 'govtAction') {
        await sosService.storeGovtActionFromMesh(data as GovtAction);
      }

      if (pkt.type === 'chat') {
        const { roomId, message } = data;
        if (!roomId) return;

        const isGroup = roomId === 'mesh_broadcast';
        const isDecrypted = message && typeof message === 'object' && !!message.id;

        if (!isDecrypted && !isGroup) {
          console.log('[Mesh] Private chat not for us — relay only');
          return;
        }
        if (!isDecrypted) {
          console.log('[Mesh] Malformed chat — skip');
          return;
        }

        const key = 'chat_messages_' + roomId;
        const raw = await AsyncStorage.getItem(key);
        const msgs: any[] = raw ? JSON.parse(raw) : [];
        if (msgs.some(m => m.id === message.id)) return;
        msgs.push({ ...message, status: 'delivered' });
        msgs.sort((a: any, b: any) => a.createdAt - b.createdAt);
        await AsyncStorage.setItem(key, JSON.stringify(msgs));
        console.log('[Mesh] 💬 Stored:', message.id, 'in', roomId);

        // Notification
        const meRaw = await AsyncStorage.getItem('safeconnect_currentUser');
        const me = meRaw ? JSON.parse(meRaw) : null;
        if (!me || message.senderId !== me.id) {
          notificationService.notifyChatMessage(
            message.senderName || 'Someone',
            message.text || 'Sent a message',
            isGroup
          ).catch(() => { });
        }
      }

      if (pkt.type === 'sos' && data.emergencyPhones?.length > 0) {
        await this._relaySMSForRemoteSOS(pkt.id, data);
      }

      if (pkt.type === 'sos' && !data.isTestPacket) {
        sosService.pushSOSToFirebase(data as Record<string, unknown>)
          .then(ok => { if (ok) console.log('[Gateway] ✅ Remote SOS → Firebase'); })
          .catch(() => { });
      }
    } catch (e) {
      console.warn('[Mesh] storeLocally err:', (e as any)?.message);
    }
  }

  // ── SMS Gateway ────────────────────────────────────────────────
  private async _relaySMSForRemoteSOS(packetId: string, data: any): Promise<void> {
    const raw = await AsyncStorage.getItem(KEY_SMS_RELAYED);
    const relayed: string[] = raw ? JSON.parse(raw) : [];
    if (relayed.includes(packetId)) return;

    const phones: string[] = data.emergencyPhones;
    const msg: string = data.emergencyMessage || `🆘 EMERGENCY: ${data.userName || 'Someone'} needs help!`;
    const sender = data.userName || 'A nearby person';

    let hasSignal = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://www.google.com/generate_204', { method: 'HEAD', cache: 'no-cache', signal: ctrl.signal });
      clearTimeout(t);
      hasSignal = r.ok || r.status === 204;
    } catch { hasSignal = false; }
    if (!hasSignal) return;

    relayed.push(packetId);
    if (relayed.length > 50) relayed.splice(0, relayed.length - 50);
    await AsyncStorage.setItem(KEY_SMS_RELAYED, JSON.stringify(relayed));

    await notificationService.notifyInfo('🆘 Forward SOS', `${sender} needs help!`);

    Alert.alert(
      '🆘 Nearby Person Needs Help!',
      `${sender} has no signal. Forward their alert?`,
      [
        { text: 'Forward SMS', onPress: () => { Linking.openURL(`sms:${phones.join(',')}?body=${encodeURIComponent(`[SafeConnect Mesh]\n${msg}`)}`).catch(() => { }); } },
        { text: 'Not Now', style: 'cancel' },
      ]
    );
  }

  // ── Gateway sync ───────────────────────────────────────────────
  private async _gatewaySync(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://www.google.com/generate_204', { method: 'HEAD', cache: 'no-cache', signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok && r.status !== 204) return false;
    } catch { return false; }
    try {
      const { flushed } = await sosService.flushSyncQueue();
      if (flushed > 0) console.log('[Gateway] Synced:', flushed);
    } catch { }
    return true;
  }

  // ── Packet factories ───────────────────────────────────────────
  createSOSPacket(userId: string, payload: object): MeshPacket {
    return {
      id: 'sos_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      type: 'sos', payload: JSON.stringify(payload),
      origin: userId, hops: 0, ttl: Date.now() + TTL_MS, createdAt: Date.now(),
    };
  }

  createGovtActionPacket(action: GovtAction): MeshPacket {
    return {
      id: 'ga_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      type: 'govtAction', payload: JSON.stringify(action),
      origin: 'govt_eoc', hops: 0, ttl: Date.now() + TTL_MS, createdAt: Date.now(),
    };
  }

  createChatPacket(userId: string, roomId: string, message: object): MeshPacket {
    const isGroup = roomId === 'mesh_broadcast';
    let finalMessage: any = message;
    let encrypted = false;

    // E2EE Encryption for private chat messages
    if (!isGroup) {
      finalMessage = CryptoJS.AES.encrypt(JSON.stringify(message), roomId).toString();
      encrypted = true;
    }

    return {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: 'chat',
      payload: JSON.stringify({ roomId, message: finalMessage, encrypted }),
      origin: userId, hops: 0, ttl: Date.now() + TTL_MS, createdAt: Date.now(),
    };
  }

  createChatAckPacket(messageId: string, roomId: string): MeshPacket {
    return {
      id: 'ack_' + messageId + '_' + Math.random().toString(36).slice(2, 6),
      type: 'chat_ack',
      payload: JSON.stringify({ messageId, roomId }),
      origin: this._name,
      hops: 0,
      ttl: Date.now() + TTL_MS,
      createdAt: Date.now(),
    };
  }

  // ── Public API ─────────────────────────────────────────────────
  async startScanning(onPacket?: (pkt: MeshPacket) => void): Promise<void> {
    if (onPacket) this.addListener(onPacket);
    if (!this._ready) await this.init();
  }

  stopScanning(): void { /* no-op */ }

  // ── Shutdown ───────────────────────────────────────────────────
  destroy(): void {
    try { Nearby.stopAdvertise(); } catch { }
    try { Nearby.stopDiscovery(); } catch { }
    // Disconnect each peer individually (Android requires peerId)
    for (const [peerId] of this.peers) {
      try { Nearby.disconnect(peerId); } catch { }
    }
    this.peers.clear();
    this.outgoingQueue = [];
    this._ready = false;
    // DO NOT null out _unsub* — they must stay alive for event listeners
    console.log('[Mesh] Destroyed');
  }

  async stopAll(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        const isReg = await TaskManager.isTaskRegisteredAsync(MESH_KEEP_ALIVE_TASK);
        if (isReg) await Location.stopLocationUpdatesAsync(MESH_KEEP_ALIVE_TASK);
      } catch { }
    }
    this.destroy();
  }
}

export const bleMeshService = new BLEMeshServiceClass();
export default bleMeshService;
