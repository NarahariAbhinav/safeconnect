/**
 * chatService.ts — Offline-first P2P Chat
 *
 * Storage strategy:
 *  • Every message is saved to AsyncStorage IMMEDIATELY (offline-first)
 *  • When internet is available → synced to Firebase for cross-device delivery
 *  • Works like WhatsApp: 1 tick = saved locally, 2 ticks = delivered to Firebase
 *
 * Room ID = sorted combo of both userIds so both sides share the same room.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const FIREBASE_URL = 'https://safeconnect-f509c-default-rtdb.asia-southeast1.firebasedatabase.app';

// ─── Types ────────────────────────────────────────────────────────
export type MessageStatus = 'sending' | 'saved' | 'delivered';

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
const roomKey = (id1: string, id2: string) =>
    `chat_room_${[id1, id2].sort().join('_')}`;

const messagesKey = (roomId: string) => `chat_messages_${roomId}`;

const genId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Connectivity check ───────────────────────────────────────────
async function isOnline(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const r = await fetch('https://www.google.com/generate_204', {
            method: 'HEAD', cache: 'no-cache', signal: controller.signal,
        });
        clearTimeout(timer);
        return r.ok || r.status === 204;
    } catch { return false; }
}

// ─── Chat Service ─────────────────────────────────────────────────
class ChatServiceClass {

    // ── Get or create room ──────────────────────────────────────────
    getRoomId(myId: string, contactId: string): string {
        return roomKey(myId, contactId);
    }

    // ── Load messages for an arbitrary roomId (e.g. mesh_broadcast) ──
    async getMessagesByRoomId(roomId: string): Promise<ChatMessage[]> {
        return this._getLocalMessages(roomId);
    }

    // ── Save a message directly to a known roomId ──────────────────
    async saveMessageToRoom(roomId: string, msg: ChatMessage): Promise<void> {
        await this._saveMessageLocally(roomId, msg);
    }

    // ── Send a message ──────────────────────────────────────────────
    async sendMessage(
        myId: string,
        myName: string,
        contactId: string,
        contactName: string,
        text: string,
        type: ChatMessage['type'] = 'text',
        metadata?: Record<string, any>
    ): Promise<ChatMessage> {
        const roomId = this.getRoomId(myId, contactId);

        const msg: ChatMessage = {
            id: genId(),
            roomId,
            senderId: myId,
            senderName: myName,
            text,
            type,
            createdAt: Date.now(),
            status: 'saving' as any,
            metadata,
        };

        // 1. Save locally immediately (OFFLINE SAFE)
        await this._saveMessageLocally(roomId, msg);
        msg.status = 'saved';

        // 2. Try to sync to Firebase
        const online = await isOnline();
        if (online) {
            try {
                await fetch(
                    `${FIREBASE_URL}/chats/${roomId}/messages/${msg.id}.json`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(msg),
                    }
                );
                // Also update room metadata
                await fetch(`${FIREBASE_URL}/chats/${roomId}/meta.json`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: roomId,
                        participantIds: [myId, contactId],
                        participantNames: [myName, contactName],
                        lastMessage: text.slice(0, 60),
                        lastMessageTime: msg.createdAt,
                        updatedAt: Date.now(),
                    }),
                });
                msg.status = 'delivered';
                await this._updateMessageStatus(roomId, msg.id, 'delivered');
                console.log('[Chat] Message delivered to Firebase ✅');
            } catch (e) {
                console.log('[Chat] Firebase sync failed, message saved locally');
            }
        } else {
            console.log('[Chat] Offline — message saved locally, will sync when online');
        }

        return msg;
    }

    // ── Get messages for a room ─────────────────────────────────────
    async getMessages(
        myId: string,
        contactId: string,
        onNewMessage?: (msg: ChatMessage) => void
    ): Promise<ChatMessage[]> {
        const roomId = this.getRoomId(myId, contactId);

        // 1. Load from local AsyncStorage
        const local = await this._getLocalMessages(roomId);

        // 2. Try to fetch from Firebase (pulls messages from the other person)
        const online = await isOnline();
        if (online) {
            try {
                const res = await fetch(`${FIREBASE_URL}/chats/${roomId}/messages.json`);
                if (res.ok) {
                    const data = await res.json();
                    if (data) {
                        const remote: ChatMessage[] = Object.values(data);
                        // Merge remote into local (add any we don't have)
                        const localIds = new Set(local.map(m => m.id));
                        const newRemote = remote.filter(m => !localIds.has(m.id));
                        if (newRemote.length > 0) {
                            const merged = [...local, ...newRemote].sort((a, b) => a.createdAt - b.createdAt);
                            await this._saveAllMessages(roomId, merged);
                            newRemote.forEach(m => onNewMessage?.(m));
                            return merged;
                        }
                    }
                }
            } catch (e) {
                console.log('[Chat] Could not fetch remote messages');
            }
        }

        return local;
    }

    // ── Fetch ALL messages for a room from Firebase (full sync) ────────────
    async fetchAllFromFirebase(myId: string, contactId: string): Promise<ChatMessage[]> {
        const roomId = this.getRoomId(myId, contactId);
        try {
            const res = await fetch(`${FIREBASE_URL}/chats/${roomId}/messages.json`);
            if (!res.ok) return [];
            const data = await res.json();
            if (!data) return [];
            return Object.values(data) as ChatMessage[];
        } catch { return []; }
    }

    // ── Poll for new messages from Firebase ─────────────────────────
    async pollNewMessages(
        myId: string,
        contactId: string,
        since: number
    ): Promise<ChatMessage[]> {
        const roomId = this.getRoomId(myId, contactId);
        const online = await isOnline();
        if (!online) return [];

        try {
            // Fetch ALL messages from Firebase (avoid broken orderBy query with index issues)
            const res = await fetch(`${FIREBASE_URL}/chats/${roomId}/messages.json`);
            if (!res.ok) return [];
            const data = await res.json();
            if (!data) return [];
            const msgs: ChatMessage[] = Object.values(data);
            // Filter: newer than since AND not sent by me
            const fresh = msgs.filter(m => m.senderId !== myId && m.createdAt > since);
            // Save any new ones locally
            for (const m of fresh) {
                await this._saveMessageLocally(roomId, m);
            }
            return fresh;
        } catch { return []; }
    }

    // ── Sync pending offline messages ───────────────────────────────
    async syncPendingMessages(): Promise<number> {
        const online = await isOnline();
        if (!online) return 0;

        const keys = await AsyncStorage.getAllKeys();
        const chatKeys = keys.filter(k => k.startsWith('chat_messages_'));
        let synced = 0;

        for (const key of chatKeys) {
            const raw = await AsyncStorage.getItem(key);
            if (!raw) continue;
            const msgs: ChatMessage[] = JSON.parse(raw);
            const pending = msgs.filter(m => m.status === 'saved');
            for (const msg of pending) {
                try {
                    await fetch(`${FIREBASE_URL}/chats/${msg.roomId}/messages/${msg.id}.json`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...msg, status: 'delivered' }),
                    });
                    msg.status = 'delivered';
                    synced++;
                } catch { /* skip */ }
            }
            await AsyncStorage.setItem(key, JSON.stringify(msgs));
        }
        return synced;
    }

    // ── Private helpers ────────────────────────────────────────────
    private async _getLocalMessages(roomId: string): Promise<ChatMessage[]> {
        const raw = await AsyncStorage.getItem(messagesKey(roomId));
        if (!raw) return [];
        return JSON.parse(raw);
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
