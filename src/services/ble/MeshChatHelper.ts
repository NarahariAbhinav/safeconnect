/**
 * MeshChatHelper.ts — Offline Chat Relay Support
 *
 * Manages a persistent queue of chat messages that need to be
 * delivered via Nearby Connections when peers come in range.
 * Messages are automatically removed after successful relay or after 24 hours.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bleMeshService } from './BLEMeshService';

const QUEUE_KEY = 'mesh_chat_pending';
const MAX_ATTEMPTS = 10;
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PendingChat {
  roomId: string;
  message: any;
  attempts: number;
  createdAt: number;
}

class MeshChatHelperClass {

  // Add a message to the pending relay queue
  async queueForMeshRelay(roomId: string, message: any): Promise<void> {
    try {
      const pending = await this._load();
      if (pending.some(p => p.message.id === message.id)) return; // already queued

      pending.push({ roomId, message, attempts: 0, createdAt: Date.now() });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(pending));
      console.log('[MeshChatHelper] Queued message for relay:', message.id);
    } catch (e) {
      console.error('[MeshChatHelper] Queue error:', e);
    }
  }

  // Attempt to relay all pending messages — call this periodically
  async relayPendingMessages(): Promise<number> {
    // No ready guard needed — broadcast() now enqueues even when not ready

    const pending = await this._load();
    if (!pending.length) return 0;

    console.log('[MeshChatHelper] Relaying', pending.length, 'pending message(s)');
    let relayed = 0;

    for (const entry of pending) {
      try {
        const pkt = bleMeshService.createChatPacket(
          entry.message.senderId,
          entry.roomId,
          entry.message,
        );
        await bleMeshService.broadcast(pkt);
        entry.attempts++;
        relayed++;
      } catch (e) {
        console.warn('[MeshChatHelper] Relay error:', (e as any)?.message);
      }
    }

    // Remove expired or over-attempted messages
    const now = Date.now();
    const remaining = pending.filter(p =>
      p.attempts < MAX_ATTEMPTS && (now - p.createdAt) < EXPIRY_MS
    );
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));

    console.log('[MeshChatHelper] Relayed:', relayed, '| Remaining:', remaining.length);
    return relayed;
  }

  // Clear all pending messages (e.g. on logout)
  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  }

  async getPendingCount(): Promise<number> {
    return (await this._load()).length;
  }

  private async _load(): Promise<PendingChat[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  }
}

export const meshChatHelper = new MeshChatHelperClass();
export default meshChatHelper;
