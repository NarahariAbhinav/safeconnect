/**
 * BLEMeshService.ts — Core Mesh Networking for SafeConnect
 *
 * Uses expo-nearby-connections (Google Nearby Connections on Android,
 * Apple Multipeer Connectivity on iOS).
 *
 * WHY: react-native-ble-plx is Central-only on Android — devices could scan
 * but were INVISIBLE to each other. Google Nearby Connections handles both
 * advertising AND discovery simultaneously using BLE + WiFi Direct with NO
 * internet required.
 *
 * Every device runs advertise + discover at the same time → true mesh.
 * Messages hop device-to-device until they reach a gateway with internet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Nearby from 'expo-nearby-connections';
import { Alert, Linking } from 'react-native';
import { chatService } from '../chatService';
import { notificationService } from '../notificationService';
import { GovtAction, sosService } from '../sos';

const KEY_SMS_RELAYED = 'ble_sms_relayed'; // track which SOS we already relayed SMS for

// Kept for backward compat (some screens import these UUIDs for display)
export const SC_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const SC_CHAR_UUID    = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

// ─── Packet ───────────────────────────────────────────────────────
export interface MeshPacket {
  id: string;
  type: 'sos' | 'needs' | 'resource' | 'ping' | 'govtAction' | 'chat';
  payload: string;   // JSON-stringified data
  origin: string;    // userId who sent this originally
  hops: number;      // incremented at each relay hop
  ttl: number;       // unix-ms expiry timestamp
  createdAt: number;
}

// UI event emitted at every connection lifecycle step — screens subscribe
// to show Bluetooth-style popups without any internet required.
export interface MeshUIEvent {
  event: 'found' | 'connecting' | 'invitation' | 'connected' | 'disconnected';
  peerId: string;
  peerName: string;
}

const MAX_HOPS    = 5;
const TTL_MS      = 12 * 60 * 60 * 1000;  // 12 hours
const KEY_SEEN    = 'ble_seen_packets';    // dedup store
const KEY_QUEUE   = 'ble_relay_queue';     // pending relay queue
const STRATEGY    = Nearby.Strategy.P2P_CLUSTER; // many-to-many mesh

// ─── Service ──────────────────────────────────────────────────────
class BLEMeshServiceClass {
  private _ready        = false;
  private _initialized  = false;
  private peers         = new Set<string>();  // currently connected peer IDs
  private pendingPeers  = new Set<string>();
  private listeners: ((pkt: MeshPacket) => void)[] = [];
  private unsubs: Array<() => void> = [];
  private _name         = 'SafeConnect';
  private peerNames     = new Map<string, string>(); // peerId → display name
  private uiListeners:  ((e: MeshUIEvent) => void)[] = [];
  private requestTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // ── Public getters ─────────────────────────────────────────────
  get ready()      { return this._ready; }
  get _peerCount() { return this.peers.size; }
  getPeerCount()   { return this.peers.size; }

  // ── UI event subscription (for connection popups in screens) ───
  addUIListener(cb: (e: MeshUIEvent) => void): void {
    if (!this.uiListeners.includes(cb)) this.uiListeners.push(cb);
  }
  removeUIListener(cb: (e: MeshUIEvent) => void): void {
    this.uiListeners = this.uiListeners.filter(l => l !== cb);
  }
  private _emitUI(e: MeshUIEvent): void {
    this.uiListeners.forEach(cb => { try { cb(e); } catch {} });
  }

  private _shouldInitiateConnection(peerName: string): boolean {
    const local = this._name.trim().toLowerCase();
    const remote = peerName.trim().toLowerCase();
    if (local && remote && local !== remote) return local > remote;
    return true;
  }

  private _getRequestDelay(peerId: string): number {
    let hash = 0;
    for (let i = 0; i < peerId.length; i++) hash = ((hash << 5) - hash) + peerId.charCodeAt(i);
    return 700 + (Math.abs(hash) % 600) + Math.floor(Math.random() * 300);
  }

  private _clearPendingPeer(peerId: string): void {
    const timer = this.requestTimers.get(peerId);
    if (timer) clearTimeout(timer);
    this.requestTimers.delete(peerId);
    this.pendingPeers.delete(peerId);
  }

  // ── init() — call once on app launch ───────────────────────────
  async init(displayName?: string): Promise<boolean> {
    if (this._initialized && this._ready) return true;

    if (displayName) this._name = displayName;

    // Register all event callbacks before starting advertising/discovery
    this._registerEvents();

    let advertiseOk = false;
    let discoverOk  = false;

    // Start advertising — makes this device visible to peers
    try {
      await Nearby.startAdvertise(this._name, STRATEGY);
      advertiseOk = true;
      console.log('[Nearby] Advertising started ✅');
    } catch (e: any) {
      console.warn('[Nearby] Advertising failed (may need permissions):', e?.message);
    }

    // Start discovery — finds other SafeConnect devices
    try {
      await Nearby.startDiscovery(this._name, STRATEGY);
      discoverOk = true;
      console.log('[Nearby] Discovery started ✅');
    } catch (e: any) {
      console.warn('[Nearby] Discovery failed:', e?.message);
    }

    this._ready       = advertiseOk || discoverOk;
    this._initialized = true;

    if (this._ready) {
      console.log('[Nearby] ✅ Mesh ready. Advertise:', advertiseOk, '| Discover:', discoverOk);
    } else {
      console.error('[Nearby] ❌ Mesh failed — check Bluetooth/WiFi permissions');
    }

    return this._ready;
  }

  // ── Register Nearby event handlers ────────────────────────────
  private _registerEvents(): void {
    // Remove previous listeners (safe to call init() multiple times)
    this.unsubs.forEach(fn => { try { fn(); } catch {} });
    this.unsubs = [];

    // Peer discovered (we are discovering, peer is advertising)
    this.unsubs.push(
      Nearby.onPeerFound(({ peerId, name }: any) => {
        const peerName = (name && name.trim()) ? name : `Device-${peerId.slice(-4)}`;
        this.peerNames.set(peerId, peerName);
        console.log('[Nearby] Peer found:', peerId, peerName);
        this._emitUI({ event: 'found', peerId, peerName });

        if (this.peers.has(peerId) || this.pendingPeers.has(peerId) || this.requestTimers.has(peerId)) {
          return;
        }

        // Reduce symmetric request collisions: prefer one initiator when names differ,
        // otherwise use a short randomized backoff and cancel if an incoming invite appears.
        if (!this._shouldInitiateConnection(peerName)) {
          console.log('[Nearby] Waiting for peer to initiate connection:', peerName);
          return;
        }

        const delay = this._getRequestDelay(peerId);
        const timer = setTimeout(() => {
          this.requestTimers.delete(peerId);
          if (this.peers.has(peerId) || this.pendingPeers.has(peerId)) return;
          this.pendingPeers.add(peerId);
          Nearby.requestConnection(peerId)
            .then(() => this._emitUI({ event: 'connecting', peerId, peerName }))
            .catch((e: any) => console.warn('[Nearby] requestConnection failed:', e?.message))
            .finally(() => this.pendingPeers.delete(peerId));
        }, delay);
        this.requestTimers.set(peerId, timer);
      })
    );

    // Peer went out of range
    this.unsubs.push(
      Nearby.onPeerLost(({ peerId }: any) => {
        const peerName = this.peerNames.get(peerId) ?? `Device-${peerId.slice(-4)}`;
        this._clearPendingPeer(peerId);
        this.peers.delete(peerId);
        this._emitUI({ event: 'disconnected', peerId, peerName });
        console.log('[Nearby] Peer lost:', peerId, '| Peers now:', this.peers.size);
      })
    );

    // Incoming connection request (we are advertising, peer is discovering)
    this.unsubs.push(
      Nearby.onInvitationReceived(({ peerId, name }: any) => {
        const peerName = (name && name.trim()) ? name : (this.peerNames.get(peerId) ?? `Device-${peerId.slice(-4)}`);
        this._clearPendingPeer(peerId);
        this.peerNames.set(peerId, peerName);
        console.log('[Nearby] Incoming invitation from:', peerId, peerName);
        this._emitUI({ event: 'invitation', peerId, peerName });
        // Always accept — SafeConnect is a trusted community app
        Nearby.acceptConnection(peerId).catch((e: any) =>
          console.warn('[Nearby] acceptConnection failed:', e?.message)
        );
      })
    );

    // Connection fully established (both sides accepted)
    this.unsubs.push(
      Nearby.onConnected(async ({ peerId, name }: any) => {
        const peerName = (name && name.trim()) ? name : (this.peerNames.get(peerId) ?? `Device-${peerId.slice(-4)}`);
        this._clearPendingPeer(peerId);
        this.peerNames.set(peerId, peerName);
        this.peers.add(peerId);
        this._emitUI({ event: 'connected', peerId, peerName });
        console.log('[Nearby] ✅ Connected to', peerId, peerName, '| Peers:', this.peers.size);
        // Immediately push any queued packets to the new peer
        await this._flushQueueTo(peerId);
      })
    );

    // Peer disconnected
    this.unsubs.push(
      Nearby.onDisconnected(({ peerId }: any) => {
        const peerName = this.peerNames.get(peerId) ?? `Device-${peerId.slice(-4)}`;
        this._clearPendingPeer(peerId);
        this.peers.delete(peerId);
        this._emitUI({ event: 'disconnected', peerId, peerName });
        console.log('[Nearby] Disconnected from', peerId, '| Peers:', this.peers.size);
      })
    );

    // Received a text payload from a peer (our packets are JSON strings)
    this.unsubs.push(
      Nearby.onTextReceived(async ({ peerId, text }: any) => {
        try {
          const pkt: MeshPacket = JSON.parse(text);
          console.log('[Nearby] Received', pkt.type, 'packet from peer', peerId);
          await this._handlePacket(pkt);
        } catch (e) {
          console.warn('[Nearby] Bad payload from', peerId, ':', e);
        }
      })
    );
  }

  // ── startScanning — public API, idempotent ─────────────────────
  async startScanning(onPacket?: (pkt: MeshPacket) => void): Promise<void> {
    if (onPacket) this.addListener(onPacket);
    if (!this._ready) await this.init();
  }

  // stopScanning is intentionally a no-op — mesh must stay active for relay
  stopScanning(): void {}

  // ── Listener management ────────────────────────────────────────
  addListener(cb: (pkt: MeshPacket) => void): void {
    if (!this.listeners.includes(cb)) this.listeners.push(cb);
  }

  removeListener(cb: (pkt: MeshPacket) => void): void {
    this.listeners = this.listeners.filter(l => l !== cb);
  }

  // ── broadcast() — queue + send to all peers ────────────────────
  async broadcast(pkt: MeshPacket): Promise<void> {
    if (!this._ready) return;
    await this._enqueue(pkt);             // persist first (offline safe)
    if (this.peers.size > 0) {
      await this._sendToAll(pkt);
    } else {
      console.log('[Nearby] No peers in range — packet queued for delivery');
    }
  }

  // ── Send one packet to all currently connected peers ───────────
  private async _sendToAll(pkt: MeshPacket): Promise<void> {
    const text = JSON.stringify(pkt);
    const stale: string[] = [];
    for (const peerId of this.peers) {
      try {
        await Nearby.sendText(peerId, text);
        console.log('[Nearby] Sent', pkt.type, 'to', peerId);
      } catch (e: any) {
        console.warn('[Nearby] Send failed to', peerId, ':', e?.message);
        stale.push(peerId);
      }
    }
    stale.forEach(id => this.peers.delete(id));
  }

  // ── When a new peer connects, push all queued packets to them ──
  private async _flushQueueTo(peerId: string): Promise<void> {
    const queue = await this._getQueue();
    if (!queue.length) return;
    console.log('[Nearby] Flushing', queue.length, 'queued packet(s) to', peerId);
    for (const pkt of queue.slice(0, 5)) {
      try {
        await Nearby.sendText(peerId, JSON.stringify(pkt));
      } catch {
        break; // peer disconnected mid-flush, stop
      }
    }
  }

  // ── Handle an incoming packet ──────────────────────────────────
  private async _handlePacket(pkt: MeshPacket): Promise<void> {
    // 1. Deduplication
    if (await this._seen(pkt.id)) { console.log('[Nearby] Dup dropped:', pkt.id); return; }
    // 2. TTL expiry
    if (Date.now() > pkt.ttl) { console.log('[Nearby] Expired dropped:', pkt.id); return; }
    // 3. Hop limit
    if (pkt.hops >= MAX_HOPS) { console.log('[Nearby] Max hops dropped:', pkt.id); return; }

    await this._markSeen(pkt.id);
    await this._storeLocally(pkt);
    this.listeners.forEach(cb => cb(pkt)); // notify UI

    // 4. If internet available, upload to Firebase (gateway role)
    const uploaded = await this._gatewaySync();
    if (!uploaded) {
      // No internet — relay to other peers (mesh hop)
      const relay: MeshPacket = { ...pkt, hops: pkt.hops + 1 };
      await this._enqueue(relay);
      if (this.peers.size > 0) await this._sendToAll(relay);
    }
  }

  // ── Store packet data locally depending on type ────────────────
  private async _storeLocally(pkt: MeshPacket): Promise<void> {
    try {
      const data = JSON.parse(pkt.payload);

      if (pkt.type === 'govtAction') {
        await sosService.storeGovtActionFromMesh(data as GovtAction);
        console.log('[Nearby] GovtAction stored locally');
      }

      if (pkt.type === 'chat') {
        const { roomId, message } = data;
        if (!roomId || !message) return;
        const key = 'chat_messages_' + roomId;
        const raw = await AsyncStorage.getItem(key);
        const msgs: any[] = raw ? JSON.parse(raw) : [];
        if (msgs.some(m => m.id === message.id)) return; // already have it
        msgs.push({ ...message, status: 'delivered' });
        msgs.sort((a, b) => a.createdAt - b.createdAt);
        await AsyncStorage.setItem(key, JSON.stringify(msgs));
        console.log('[Nearby] Chat message stored locally:', message.id);
      }

      // ── SMS Gateway Relay — forward SOS alerts to non-app contacts ──
      // When we receive an SOS from another user via mesh and we have signal,
      // offer to send their emergency SMS to their contacts (who may not have
      // SafeConnect). This is how User B (no app, has signal) gets notified.
      if (pkt.type === 'sos' && data.emergencyPhones?.length > 0) {
        await this._relaySMSForRemoteSOS(pkt.id, data);
      }

      // ── Firebase Gateway Relay — push remote SOS to govt dashboard ──
      // If this gateway device has internet, upload the remote user's SOS
      // directly to Firebase so the govt dashboard sees it immediately,
      // even though User A (the sender) has no internet themselves.
      if (pkt.type === 'sos' && !data.isTestPacket) {
        sosService.pushSOSToFirebase(data as Record<string, unknown>)
          .then(ok => { if (ok) console.log('[Gateway] ✅ Remote SOS pushed to Firebase dashboard'); })
          .catch(() => {});
      }
    } catch (e) {
      console.warn('[Nearby] storeLocally error:', (e as any)?.message);
    }
  }

  /**
   * SMS Gateway Relay — the critical bridge for non-app contacts.
   *
   * Scenario: User A (no signal, in disaster) → mesh → this device (gateway, has signal)
   *           → SMS → User B (no SafeConnect app, has signal)
   *
   * This device opens the SMS compose screen pre-filled with User A's
   * emergency contacts and message. The gateway user just taps Send.
   */
  private async _relaySMSForRemoteSOS(packetId: string, data: any): Promise<void> {
    // Check if we already relayed SMS for this SOS (dedup)
    const raw = await AsyncStorage.getItem(KEY_SMS_RELAYED);
    const relayed: string[] = raw ? JSON.parse(raw) : [];
    if (relayed.includes(packetId)) return;

    const phones: string[] = data.emergencyPhones;
    const message: string = data.emergencyMessage || `🆘 EMERGENCY: ${data.userName || 'Someone'} needs help!`;
    const senderName = data.userName || 'A nearby person';

    // Check if this device has internet (i.e. gateway with signal)
    let hasSignal = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD', cache: 'no-cache', signal: ctrl.signal,
      });
      clearTimeout(t);
      hasSignal = r.ok || r.status === 204;
    } catch { hasSignal = false; }

    if (!hasSignal) {
      console.log('[Gateway] No signal — cannot relay SMS for', senderName);
      return;
    }

    // Mark as relayed immediately to avoid duplicate prompts
    relayed.push(packetId);
    if (relayed.length > 50) relayed.splice(0, relayed.length - 50);
    await AsyncStorage.setItem(KEY_SMS_RELAYED, JSON.stringify(relayed));

    // Show push notification
    await notificationService.notifyInfo(
      '🆘 Forward SOS Alert',
      `${senderName} is in danger nearby! Tap to forward their emergency SMS to ${phones.length} contact(s).`
    );

    // Show alert with action to forward SMS
    const relayMessage = `[Forwarded via SafeConnect Mesh]\n${message}`;

    Alert.alert(
      '🆘 Nearby Person Needs Help!',
      `${senderName} has no signal and sent an SOS via mesh.\n\n` +
      `You have signal — tap "Forward SMS" to send their emergency alert to their ${phones.length} contact(s).\n\n` +
      `This is how their family/friends will know they need help.`,
      [
        {
          text: 'Forward SMS',
          onPress: () => {
            // Open SMS compose with all emergency contacts pre-filled
            const phoneList = phones.join(',');
            Linking.openURL(
              `sms:${phoneList}?body=${encodeURIComponent(relayMessage)}`
            ).catch(e => console.warn('[Gateway] SMS relay open failed:', e));
            console.log('[Gateway] ✅ SMS relay opened for', senderName, '→', phones.length, 'contacts');
          },
        },
        { text: 'Not Now', style: 'cancel' },
      ]
    );
  }

  // ── Upload pending SOS/chat to Firebase when internet is back ──
  // Also re-enqueues the SOS data with emergency phones so Firebase has them
  // (govt dashboard can see contact numbers and call them directly)
  private async _gatewaySync(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD', cache: 'no-cache', signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!r.ok && r.status !== 204) return false;
    } catch {
      return false; // offline
    }
    try { const { flushed } = await sosService.flushSyncQueue(); if (flushed > 0) console.log('[Nearby→Firebase] SOS synced:', flushed); } catch {}
    try { const n = await chatService.syncPendingMessages(); if (n > 0) console.log('[Nearby→Firebase] Chat synced:', n); } catch {}
    return true;
  }

  // ── Seen-packet deduplication ──────────────────────────────────
  private async _seen(id: string): Promise<boolean> {
    const raw = await AsyncStorage.getItem(KEY_SEEN);
    return (raw ? JSON.parse(raw) as string[] : []).includes(id);
  }

  private async _markSeen(id: string): Promise<void> {
    const raw  = await AsyncStorage.getItem(KEY_SEEN);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    seen.push(id);
    if (seen.length > 200) seen.splice(0, seen.length - 200);
    await AsyncStorage.setItem(KEY_SEEN, JSON.stringify(seen));
  }

  // ── Relay queue persistence ────────────────────────────────────
  private async _getQueue(): Promise<MeshPacket[]> {
    const raw = await AsyncStorage.getItem(KEY_QUEUE);
    return raw ? JSON.parse(raw) : [];
  }

  private async _enqueue(pkt: MeshPacket): Promise<void> {
    const q = await this._getQueue();
    if (q.some(p => p.id === pkt.id)) return; // already queued
    q.push(pkt);
    if (q.length > 50) q.splice(0, q.length - 50);
    await AsyncStorage.setItem(KEY_QUEUE, JSON.stringify(q));
  }

  // ── Packet factory methods (unchanged API) ─────────────────────
  createSOSPacket(userId: string, payload: object): MeshPacket {
    return {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
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
    return {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      type: 'chat', payload: JSON.stringify({ roomId, message }),
      origin: userId, hops: 0, ttl: Date.now() + TTL_MS, createdAt: Date.now(),
    };
  }

  // ── Full shutdown ──────────────────────────────────────────────
  destroy(): void {
    this.unsubs.forEach(fn => { try { fn(); } catch {} });
    this.unsubs = [];
    this.listeners = [];
    this.uiListeners = [];
    this.requestTimers.forEach(timer => clearTimeout(timer));
    this.requestTimers.clear();
    this.pendingPeers.clear();
    this.peerNames.clear();
    try { Nearby.stopAdvertise(); }  catch {}
    try { Nearby.stopDiscovery(); }  catch {}
    try { Nearby.disconnect(); }     catch {}
    this._ready = false;
    this._initialized = false;
    this.peers.clear();
    console.log('[Nearby] Service destroyed');
  }
}

export const bleMeshService = new BLEMeshServiceClass();
export default bleMeshService;
