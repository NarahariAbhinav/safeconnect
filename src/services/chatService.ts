/**
 * chatService.ts — Pure Offline P2P Chat
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  OFFLINE-FIRST DESIGN — ZERO FIREBASE DEPENDENCY FOR CHAT   ║
 * ║                                                              ║
 * ║  Message delivery is EXCLUSIVELY via:                        ║
 * ║    1. AsyncStorage  — persistent local storage               ║
 * ║    2. BLE Mesh (expo-nearby-connections) — P2P relay         ║
 * ║                                                              ║
 * ║  Firebase is NOT used for chat. Firebase is only used for:   ║
 * ║    • SOS emergency alerts (govt dashboard visibility)        ║
 * ║    • Government rescue team dispatch notifications           ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Flow:
 *   Send  → save to AsyncStorage → broadcast via BLE mesh
 *   Receive → BLEMeshService._storeLocally() saves to AsyncStorage
 *           → UI listener / storage poll shows new message
 *
 * Room ID = sorted phone numbers so both sides share the same key.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { canonicalRoomId } from './meshUtils';

// ─── Types ────────────────────────────────────────────────────────
export type MessageStatus = 'sending' | 'saved' | 'delivered' | 'ack';

export interface ChatMessage {
    id: string;
    roomId: string;
    senderId: string;
    senderName: string;
    text: string;
    type: 'text' | 'voice' | 'location' | 'sos_alert';
    createdAt: number;
    status: MessageStatus;
    metadata?: Record<string, any>;
}

export interface ChatRoom {
    id: string;
    participantIds: string[];
    participantNames: string[];
    lastMessage?: string;
    lastMessageTime?: number;
    unreadCount: number;
}

// ─── Key helpers ─────────────────────────────────────────────────
// NOTE: room keys are produced by canonicalRoomId() from meshUtils.
// Do NOT compute them inline — that was the source of the ghost-room bug.
const messagesKey = (roomId: string) => `chat_messages_${roomId}`;

const genId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Chat Service ─────────────────────────────────────────────────
class ChatServiceClass {

    // ── Get room ID (shared by both devices via sorted, normalised phone numbers) ──
    getRoomId(myId: string, contactId: string): string {
        return canonicalRoomId(myId, contactId);
    }

    // ── Load all messages for a room from local storage ─────────────
    async getMessagesByRoomId(roomId: string): Promise<ChatMessage[]> {
        return this._getLocalMessages(roomId);
    }

    // ── Save a message directly to a known roomId ───────────────────
    async saveMessageToRoom(roomId: string, msg: ChatMessage): Promise<void> {
        await this._saveMessageLocally(roomId, msg);
    }

    /**
     * Send a message.
     *
     * OFFLINE-FIRST: saves to AsyncStorage immediately.
     * Status is set to 'saved' (single tick) — it becomes 'delivered'
     * once the receiving device's BLE listener stores it locally and
     * the UI poll picks it up. There is NO Firebase involvement.
     *
     * The caller (MeshChatScreen) is responsible for broadcasting
     * the message via bleMeshService.broadcast() after calling this.
     */
    async sendMessage(
        myId: string,
        myName: string,
        contactId: string,
        _contactName: string,   // kept for API compat, unused without Firebase
        text: string,
        type: ChatMessage['type'] = 'text',
        metadata?: Record<string, any>
    ): Promise<ChatMessage> {
        const roomId = canonicalRoomId(myId, contactId);

        const msg: ChatMessage = {
            id: genId(),
            roomId,
            senderId: myId,
            senderName: myName,
            text,
            type,
            createdAt: Date.now(),
            status: 'saved',  // saved locally — mesh delivery marks it 'delivered'
            metadata,
        };

        // Save locally immediately (works fully offline)
        await this._saveMessageLocally(roomId, msg);
        console.log('[Chat] ✅ Message saved locally:', msg.id);

        return msg;
    }

    // ── Get messages for a room (local only) ────────────────────────
    async getMessages(
        myId: string,
        contactId: string,
        _onNewMessage?: (msg: ChatMessage) => void
    ): Promise<ChatMessage[]> {
        const roomId = canonicalRoomId(myId, contactId);
        return this._getLocalMessages(roomId);
    }

    /**
     * Poll for new messages by roomId.
     *
     * OFFLINE-FIRST: reads only from local AsyncStorage.
     * Returns messages from others that arrived since `since` timestamp.
     * BLEMeshService._storeLocally() writes incoming BLE packets here.
     */
    async pollNewMessagesByRoomId(
        roomId: string,
        myId: string,
        since: number
    ): Promise<ChatMessage[]> {
        const all = await this._getLocalMessages(roomId);
        // Return messages from other senders that arrived after `since`
        return all.filter(m => m.senderId !== myId && m.createdAt > since);
    }

    // ── Poll for new messages (legacy API compat) ───────────────────
    async pollNewMessages(
        myId: string,
        contactId: string,
        since: number
    ): Promise<ChatMessage[]> {
        const roomId = canonicalRoomId(myId, contactId);
        return this.pollNewMessagesByRoomId(roomId, myId, since);
    }

    /**
     * Mark a message as delivered (called after BLE broadcast confirms receipt).
     * This was previously done by Firebase — now done locally.
     */
    async markAsDelivered(roomId: string, msgId: string): Promise<void> {
        await this._updateMessageStatus(roomId, msgId, 'delivered');
    }

    /**
     * syncMessageToFirebase — REMOVED (no Firebase for chat).
     * Kept as a no-op for API compatibility so no callers break.
     * @deprecated Use BLE mesh broadcast instead.
     */
    async syncMessageToFirebase(_roomId: string, _msg: ChatMessage): Promise<boolean> {
        console.log('[Chat] syncMessageToFirebase() called but Firebase chat is disabled. Use BLE mesh.');
        return false;
    }

    /**
     * syncPendingMessages — REMOVED (no Firebase for chat).
     * BLEMeshService._gatewaySync calls this — returning 0 is safe.
     * @deprecated Messages are delivered via BLE, not Firebase.
     */
    async syncPendingMessages(): Promise<number> {
        // No-op: chat sync to Firebase is disabled.
        // BLE mesh is the delivery mechanism.
        return 0;
    }

    /**
     * fetchAllFromFirebase — REMOVED (no Firebase for chat).
     * @deprecated Returns local messages instead.
     */
    async fetchAllFromFirebase(myId: string, contactId: string): Promise<ChatMessage[]> {
        console.log('[Chat] fetchAllFromFirebase() is disabled. Returning local messages.');
        const roomId = canonicalRoomId(myId, contactId);
        return this._getLocalMessages(roomId);
    }

    // ── Clear all messages for a room (e.g. on logout) ─────────────
    async clearRoom(roomId: string): Promise<void> {
        await AsyncStorage.removeItem(messagesKey(roomId));
    }

    // ── Clear ALL chat data (logout / reset) ────────────────────────
    async clearAllChats(): Promise<void> {
        const keys = await AsyncStorage.getAllKeys();
        const chatKeys = keys.filter(k => k.startsWith('chat_messages_'));
        if (chatKeys.length > 0) {
            await AsyncStorage.multiRemove(chatKeys);
        }
        console.log('[Chat] All local chat data cleared.');
    }

    // ── Private helpers ────────────────────────────────────────────
    private async _getLocalMessages(roomId: string): Promise<ChatMessage[]> {
        try {
            const raw = await AsyncStorage.getItem(messagesKey(roomId));
            if (!raw) return [];
            return JSON.parse(raw) as ChatMessage[];
        } catch {
            return [];
        }
    }

    private async _saveMessageLocally(roomId: string, msg: ChatMessage): Promise<void> {
        const existing = await this._getLocalMessages(roomId);
        const updated = [...existing.filter(m => m.id !== msg.id), msg]
            .sort((a, b) => a.createdAt - b.createdAt);
        await AsyncStorage.setItem(messagesKey(roomId), JSON.stringify(updated));
    }

    private async _saveAllMessages(roomId: string, msgs: ChatMessage[]): Promise<void> {
        await AsyncStorage.setItem(messagesKey(roomId), JSON.stringify(msgs));
    }

    private async _updateMessageStatus(
        roomId: string, msgId: string, status: MessageStatus
    ): Promise<void> {
        const msgs = await this._getLocalMessages(roomId);
        const updated = msgs.map(m => m.id === msgId ? { ...m, status } : m);
        await AsyncStorage.setItem(messagesKey(roomId), JSON.stringify(updated));
    }
}

export const chatService = new ChatServiceClass();
export default chatService;
