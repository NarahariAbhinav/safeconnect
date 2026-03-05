/**
 * MeshChatHelper.ts — Offline Chat Relay Support
 *
 * Handles reliable offline message delivery through BLE mesh
 * Messages are automatically relayed to nearby devices and sync to Firebase when online
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { bleMeshService } from './BLEMeshService';

const PENDING_MESH_CHATS_KEY = 'mesh_chat_pending';

interface PendingMeshChat {
    roomId: string;
    message: any;
    attempts: number;
    createdAt: number;
}

class MeshChatHelperClass {
    /**
     * Queue a chat message for BLE mesh relay
     * Call this after sendMessage so offline users get the message when a peer is in range
     */
    async queueForMeshRelay(roomId: string, message: any): Promise<void> {
        try {
            const pending = await this._getPending();
            const newEntry: PendingMeshChat = {
                roomId,
                message,
                attempts: 0,
                createdAt: Date.now(),
            };

            // Don't add duplicates
            if (pending.some(p => p.message.id === message.id)) {
                console.log('[MeshChatHelper] Message already queued for relay');
                return;
            }

            pending.push(newEntry);
            await AsyncStorage.setItem(PENDING_MESH_CHATS_KEY, JSON.stringify(pending));
            console.log('[MeshChatHelper] Message queued for BLE mesh relay');
        } catch (e) {
            console.error('[MeshChatHelper] Queue failed:', e);
        }
    }

    /**
     * Attempt to relay all pending chat messages via BLE mesh
     * Called periodically by background relay service
     */
    async relayPendingMessages(): Promise<number> {
        if (!bleMeshService.ready) {
            console.log('[MeshChatHelper] BLE not ready, skipping relay');
            return 0;
        }

        try {
            const pending = await this._getPending();
            if (pending.length === 0) return 0;

            console.log(`[MeshChatHelper] Attempting to relay ${pending.length} chat message(s)...`);

            let relayed = 0;

            for (const entry of pending) {
                try {
                    // Create BLE mesh packet
                    const pkt = bleMeshService.createChatPacket(
                        entry.message.senderId,
                        entry.roomId,
                        entry.message
                    );

                    // Try to broadcast
                    await bleMeshService.broadcast(pkt);
                    relayed++;
                    entry.attempts++;

                    // Remove if attempted 5+ times (give up after ~2.5 minutes with 30s intervals)
                    if (entry.attempts > 5) {
                        console.log('[MeshChatHelper] Message reached max relay attempts, removing');
                        pending.splice(pending.indexOf(entry), 1);
                    }
                } catch (e) {
                    console.warn('[MeshChatHelper] Relay attempt failed for message:', (e as any)?.message);
                    entry.attempts++;
                }
            }

            // Save updated pending list
            await AsyncStorage.setItem(PENDING_MESH_CHATS_KEY, JSON.stringify(pending));

            if (relayed > 0) {
                console.log(`[MeshChatHelper] Relayed ${relayed} message(s) ✅`);
            }

            return relayed;
        } catch (e) {
            console.error('[MeshChatHelper] Relay failed:', e);
            return 0;
        }
    }

    /**
     * Get count of pending relay messages
     */
    async getPendingCount(): Promise<number> {
        const pending = await this._getPending();
        return pending.length;
    }

    /**
     * Clear all pending messages (call after successful sync)
     */
    async clearPending(): Promise<void> {
        await AsyncStorage.removeItem(PENDING_MESH_CHATS_KEY);
        console.log('[MeshChatHelper] Cleared pending relay messages');
    }

    // ── Internal ──────────────────────────────────────────────────

    private async _getPending(): Promise<PendingMeshChat[]> {
        try {
            const raw = await AsyncStorage.getItem(PENDING_MESH_CHATS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }
}

export const meshChatHelper = new MeshChatHelperClass();
export default meshChatHelper;
