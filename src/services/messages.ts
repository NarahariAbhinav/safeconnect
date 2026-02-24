/**
 * messages.ts — Per-contact message storage
 *
 * Supports 4 message types:
 *  • text     — plain text
 *  • voice    — audio recording (uri + duration in seconds)
 *  • location — lat/lng + address string
 *  • file     — file uri + name + size + mime type
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ──────────────────────────────────────────────────────────
export type MessageType = 'text' | 'voice' | 'location' | 'file';

export interface LocationPayload {
    latitude: number;
    longitude: number;
    address: string;
}

export interface VoicePayload {
    uri: string;
    durationSec: number;
}

export interface FilePayload {
    uri: string;
    name: string;
    sizeBytes: number;
    mimeType: string;
}

export interface Message {
    id: string;
    contactId: string;
    type: MessageType;
    fromMe: boolean;
    sentAt: number;          // epoch ms
    // Only one of these will be non-null depending on type
    text?: string;
    voice?: VoicePayload;
    location?: LocationPayload;
    file?: FilePayload;
    status: 'sent' | 'delivered' | 'read';
}

// ─── Storage Key ────────────────────────────────────────────────────
const storageKey = (contactId: string) => `safeconnect_messages_${contactId}`;

// ─── CRUD ───────────────────────────────────────────────────────────
export async function getMessages(contactId: string): Promise<Message[]> {
    try {
        const raw = await AsyncStorage.getItem(storageKey(contactId));
        return raw ? (JSON.parse(raw) as Message[]) : [];
    } catch {
        return [];
    }
}

export async function sendMessage(msg: Omit<Message, 'id' | 'sentAt' | 'status'>): Promise<Message> {
    const existing = await getMessages(msg.contactId);
    const newMsg: Message = {
        ...msg,
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sentAt: Date.now(),
        status: 'sent',
    };
    const updated = [...existing, newMsg];
    await AsyncStorage.setItem(storageKey(msg.contactId), JSON.stringify(updated));
    return newMsg;
}

export async function deleteMessage(contactId: string, messageId: string): Promise<Message[]> {
    const existing = await getMessages(contactId);
    const updated = existing.filter(m => m.id !== messageId);
    await AsyncStorage.setItem(storageKey(contactId), JSON.stringify(updated));
    return updated;
}

export async function clearMessages(contactId: string): Promise<void> {
    await AsyncStorage.removeItem(storageKey(contactId));
}

// ─── Helpers ─────────────────────────────────────────────────────────
export function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMessageTime(epoch: number): string {
    const d = new Date(epoch);
    const now = new Date();
    const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
    if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) +
        ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const messagesService = {
    getMessages,
    sendMessage,
    deleteMessage,
    clearMessages,
    formatDuration,
    formatFileSize,
    formatMessageTime,
};

export default messagesService;
