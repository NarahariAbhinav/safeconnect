/**
 * MeshChatScreen.tsx — Offline-first Chat
 *
 * FIX 1: Peer count is now reactive (subscribes to UI events) so BOTH
 *         devices update instantly when connected — no stale renders.
 *
 * FIX 2: Private chat roomId now uses PHONE NUMBER as the shared key.
 *         The old code used local expo-contacts IDs which differ between
 *         devices, so Device A's roomId never matched Device B's roomId.
 *         Phone numbers are the only truly shared identifier.
 *
 * FIX 3: Offline connectivity ping has a 3 s timeout so the screen
 *         does not hang. Private chat messages are received purely via
 *         BLE mesh and stored locally — no internet required.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { bleBackgroundRelayService } from '../services/ble/BLEBackgroundRelayService';
import { bleMeshService, MeshUIEvent } from '../services/ble/BLEMeshService';
import { meshChatHelper } from '../services/ble/MeshChatHelper';
import { ChatMessage, chatService } from '../services/chatService';
import { contactsService, TrustedContact } from '../services/contacts';
import { permissionService } from '../services/permissionService';

// ─── Colors ─────────────────────────────────────────────────────
const C = {
    bg: '#EBF4F7', brown: '#2C1A0E', muted: '#8C7060',
    white: '#FFFFFF', green: '#2A7A5A', greenLight: 'rgba(42,122,90,0.12)',
    blue: '#1565C0', blueLight: 'rgba(21,101,192,0.10)',
    orange: '#E05A2B', border: 'rgba(44,26,14,0.08)',
    card: '#FFFFFF', bubbleMe: '#2A7A5A', bubbleThem: '#FFFFFF',
    offline: '#E65100',
};

// ─── Icons ──────────────────────────────────────────────────────
const BackIcon = () => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M12 19l-7-7 7-7" stroke={C.brown} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const SendIcon = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={C.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

type Params = { MeshChat: { userId: string; userName: string; userPhone?: string } };
type Props = NativeStackScreenProps<Params, 'MeshChat'>;

// ─── Mesh Group Chat constants ──────────────────────────────────
const MESH_GROUP_ID = '__mesh_broadcast__';
const MESH_GROUP_ROOM = 'mesh_broadcast';
const meshGroupContact: TrustedContact = {
    id: MESH_GROUP_ID,
    name: 'Mesh Group Chat',
    phone: '',
    relationship: 'All nearby SafeConnect users',
    addedAt: 0,
};

/**
 * Compute a stable roomId that BOTH devices will agree on.
 * Uses phone numbers (sorted) since they are the only truly shared
 * identifiers — local expo-contacts IDs differ between devices.
 */
function normalizePhone10(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : '';
}

function privateRoomId(myPhone: string, contactPhone: string): string {
    const a = normalizePhone10(myPhone);
    const b = normalizePhone10(contactPhone);
    if (!a || !b) return '';
    return `room_${[a, b].sort().join('_')}`;
}

const MeshChatScreen: React.FC<Props> = ({ navigation, route }) => {
    const { userId, userName, userPhone: paramPhone = '' } = route.params;

    // Resolved phone — starts from nav param, falls back to stored user profile.
    // This handles existing users whose session predates the userPhone param being added.
    const [userPhone, setUserPhone] = useState(paramPhone);

    const [screen, setScreen] = useState<'list' | 'chat'>('list');
    const [contacts, setContacts] = useState<TrustedContact[]>([]);
    const [activeContact, setContact] = useState<TrustedContact | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [online, setOnline] = useState<boolean | null>(null);

    // FIX 1: peer count as reactive state, updated by UI events
    const [peerCount, setPeerCount] = useState(() => bleMeshService.getPeerCount());

    const flatRef = useRef<FlatList<ChatMessage>>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const messagesRef = useRef<ChatMessage[]>([]);

    // ── Load userPhone from stored profile if not passed via nav ──
    useEffect(() => {
        if (paramPhone) return; // already have it from nav params
        // Fallback: read from stored user profile in AsyncStorage
        import('@react-native-async-storage/async-storage').then(({ default: AS }) => {
            AS.getItem('safeconnect_currentUser').then(raw => {
                if (!raw) return;
                try {
                    const stored = JSON.parse(raw);
                    const phone = stored?.phone || stored?.phoneNumber || stored?.mobile || '';
                    if (phone) {
                        console.log('[MeshChat] Resolved userPhone from storage:', phone);
                        setUserPhone(phone);
                    }
                } catch { }
            });
        });
    }, [paramPhone]);

    // ── Load contacts ──────────────────────────────────────────
    useEffect(() => {
        contactsService.getTrusted().then(setContacts);
    }, []);

    // ── FIX 1: Subscribe to mesh UI events to update peer count ──
    // Both devices now get real-time peer count updates
    useEffect(() => {
        const handleUI = (e: MeshUIEvent) => {
            if (e.event === 'connected' || e.event === 'disconnected') {
                setPeerCount(bleMeshService.getPeerCount());
            }
        };
        bleMeshService.addUIListener(handleUI);
        // Poll as backup every 5s
        const interval = setInterval(() => {
            setPeerCount(bleMeshService.getPeerCount());
        }, 5000);
        return () => {
            bleMeshService.removeUIListener(handleUI);
            clearInterval(interval);
        };
    }, []);

    // ── FIX 3: Connectivity check with timeout ─────────────────
    useEffect(() => {
        const ping = async () => {
            try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 3000);
                const r = await fetch('https://www.google.com/generate_204', {
                    method: 'HEAD', cache: 'no-cache', signal: ctrl.signal,
                });
                clearTimeout(t);
                setOnline(r.ok || r.status === 204);
            } catch {
                setOnline(false);
            }
        };
        ping();
        const t = setInterval(ping, 15_000);
        return () => clearInterval(t);
    }, []);

    // ── Open chat ──────────────────────────────────────────────
    const openChat = useCallback(async (contact: TrustedContact) => {
        setContact(contact);
        setMessages([]);
        messagesRef.current = [];
        setScreen('chat');

        const isGroup = contact.id === MESH_GROUP_ID;

        // FIX 2: use phone-based roomId for private chats
        const roomId = isGroup
            ? MESH_GROUP_ROOM
            : privateRoomId(userPhone, contact.phone);

        if (!isGroup && !roomId) {
            Alert.alert(
                'Phone Number Required',
                'Private offline chat needs valid phone numbers on both devices. Please update your profile phone and contact phone number.'
            );
            return;
        }

        // Load local messages immediately (works fully offline)
        const localMsgs = await chatService.getMessagesByRoomId(roomId);
        setMessages(localMsgs);
        messagesRef.current = localMsgs;
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);

        // Group chat: purely BLE — no Firebase polling needed
        if (isGroup) return;

        // Private chat: poll local storage every 5s for new BLE-delivered messages.
        // BLEMeshService._storeLocally() writes received packets here, so polling
        // this covers messages received while on another screen.
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            // Poll local AsyncStorage for any new messages delivered via BLE mesh.
            // BLEMeshService._storeLocally() writes incoming packets directly to AsyncStorage,
            // so this catches messages received while this screen was not the active listener.
            const localAll = await chatService.getMessagesByRoomId(roomId);
            // Use ID-set comparison (not just length) so status updates also get picked up
            const existingIds = new Set(messagesRef.current.map(m => m.id));
            const newLocal = localAll.filter(m => !existingIds.has(m.id));
            if (newLocal.length > 0) {
                setMessages(prev => {
                    const ids = new Set(prev.map((m: ChatMessage) => m.id));
                    const merged = [...prev, ...newLocal.filter((m: ChatMessage) => !ids.has(m.id))]
                        .sort((a, b) => a.createdAt - b.createdAt);
                    messagesRef.current = merged;
                    return merged;
                });
                setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
            }
        }, 5_000);
    }, [userId, userPhone]);

    // ── BLE listener: receive mesh packets live ────────────────
    useEffect(() => {
        if (!activeContact) return;
        const isGroup = activeContact.id === MESH_GROUP_ID;
        const roomId = isGroup
            ? MESH_GROUP_ROOM
            : privateRoomId(userPhone, activeContact.phone);
        if (!isGroup && !roomId) return;

        const handleBlePacket = (pkt: any) => {
            if (pkt.type !== 'chat') return;
            try {
                const payload = JSON.parse(pkt.payload);
                const { roomId: pktRoom, message } = payload;

                if (pktRoom !== roomId) return;

                // Ignore own messages coming back via mesh relay — we already
                // displayed them immediately when the user tapped Send.
                if (message.senderId === userId) return;

                // Safety: message must be a valid object with an id
                if (!message || typeof message !== 'object' || !message.id) {
                    console.warn('[MeshChat] Received malformed message in packet:', pkt.id);
                    return;
                }

                console.log('[MeshChat] 📦 BLE packet received for room:', roomId, 'msg id:', message.id);

                setMessages(prev => {
                    if (prev.some(m => m.id === message.id)) return prev; // dedup
                    const merged = [...prev, { ...message, status: 'delivered' as const }]
                        .sort((a: any, b: any) => a.createdAt - b.createdAt);
                    messagesRef.current = merged;
                    return merged;
                });
                // Persist so messages survive navigation
                chatService.saveMessageToRoom(roomId, { ...message, status: 'delivered' }).catch(() => { });
                setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
            } catch (e) {
                console.warn('[MeshChat] Could not parse BLE packet:', e);
            }
        };

        bleMeshService.addListener(handleBlePacket);
        console.log('[MeshChat] BLE listener registered for room:', roomId);

        // Auto-start mesh if it was stopped (e.g. after background kill).
        // This ensures Device B/C can SEND messages the moment they open chat.
        if (!bleMeshService.ready) {
            console.log('[MeshChat] Mesh not ready — attempting auto-restart...');
            AsyncStorage.getItem('safeconnect_perms_shown').then((shown: string | null) => {
                if (shown) {
                    permissionService.enableMesh({ displayName: userName, showEnabledAlert: false })
                        .catch(() => { });
                }
            }).catch(() => { });
        }

        // Ensure background relay loop is running (retries queued messages every 30s)
        bleBackgroundRelayService.startRelay().catch(() => { });
        // Note: relayPendingMessages() is intentionally NOT called here on every chat open.
        // The bleBackgroundRelayService 30s loop handles retries automatically.

        // For group chat: also poll local storage every 5s to catch messages
        // received while another screen was active (BLE delivers to storage even
        // when this listener wasn't registered).
        let pollTimer: ReturnType<typeof setInterval> | null = null;
        if (isGroup) {
            pollTimer = setInterval(async () => {
                const stored = await chatService.getMessagesByRoomId(MESH_GROUP_ROOM);
                if (stored.length > messagesRef.current.length) {
                    const existingIds = new Set(messagesRef.current.map(m => m.id));
                    const newOnes = stored.filter(m => !existingIds.has(m.id));
                    if (newOnes.length > 0) {
                        setMessages(prev => {
                            const ids = new Set(prev.map(m => m.id));
                            const merged = [...prev, ...newOnes.filter(m => !ids.has(m.id))]
                                .sort((a: any, b: any) => a.createdAt - b.createdAt);
                            messagesRef.current = merged;
                            return merged;
                        });
                        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
                    }
                }
            }, 5000);
        }

        return () => {
            bleMeshService.removeListener(handleBlePacket);
            if (pollTimer) clearInterval(pollTimer);
            console.log('[MeshChat] BLE listener removed for room:', roomId);
        };
    }, [activeContact, userId, userPhone]);

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

    // ── Send ───────────────────────────────────────────────────
    const sendMessage = async () => {
        if (!inputText.trim() || !activeContact || sending) return;
        const text = inputText.trim();
        setInputText('');
        setSending(true);

        const isGroup = activeContact.id === MESH_GROUP_ID;
        // FIX 2: use phone-based roomId
        const roomId = isGroup
            ? MESH_GROUP_ROOM
            : privateRoomId(userPhone, activeContact.phone);

        if (!isGroup && !roomId) {
            Alert.alert(
                'Cannot Send Private Message',
                'Missing valid phone number for you or this contact. Use Mesh Group Chat or update phone numbers first.'
            );
            setSending(false);
            return;
        }

        try {
            const genId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const msg: ChatMessage = {
                id: genId(),
                roomId,
                senderId: userId,
                senderName: userName,
                text,
                type: 'text',
                createdAt: Date.now(),
                status: 'saved',  // ✓ grey — saved locally
            };

            // Save locally first (offline-safe)
            await chatService.saveMessageToRoom(roomId, msg);

            // Show immediately in UI with single tick ✓
            setMessages(prev => [...prev, msg]);
            messagesRef.current = [...messagesRef.current, msg];

            // Broadcast via BLE mesh — works offline, queued even if mesh not ready.
            // broadcast() now always enqueues so background relay retries on next connection.
            const pkt = bleMeshService.createChatPacket(userId, roomId, msg);
            await bleMeshService.broadcast(pkt).catch(e =>
                console.warn('[MeshChat] BLE broadcast error:', e?.message)
            );
            console.log('[MeshChat] Message broadcast/queued via BLE ✅');

            // Upgrade to ✓✓ (delivered) if at least one peer was connected
            if (bleMeshService.ready && bleMeshService.getPeerCount() > 0) {
                const deliveredMsg: ChatMessage = { ...msg, status: 'delivered' };
                await chatService.saveMessageToRoom(roomId, deliveredMsg);
                setMessages(prev =>
                    prev.map(m => (m.id === msg.id ? deliveredMsg : m))
                );
                messagesRef.current = messagesRef.current.map(m =>
                    m.id === msg.id ? deliveredMsg : m
                );
            }

            // Queue for retry for BOTH group AND private chat.
            // Group chat was previously not queued, so messages were silently lost
            // when Device B/C had mesh in a not-ready state.
            await meshChatHelper.queueForMeshRelay(roomId, msg);
            // Note: Messages are delivered via BLE mesh only. Firebase is NOT used.

        } catch (e) {
            console.error('[MeshChat] Send failed:', e);
        } finally {
            setSending(false);
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
        }
    };

    const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tickIcon = (st: ChatMessage['status']) => st === 'delivered' ? '✓✓' : st === 'saved' ? '✓' : '⏳';
    const initials = (name: string) => name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);

    // ── Online indicator ──────────────────────────────────────
    const OnlineBadge = () => (
        <View style={[styles.badge, { backgroundColor: online ? C.greenLight : 'rgba(230,81,0,0.12)', borderColor: online ? C.green : C.offline }]}>
            <Text style={[styles.badgeText, { color: online ? C.green : C.offline }]}>
                {online === null ? '⏳' : online ? '📶 Online' : '📵 Offline'}
            </Text>
        </View>
    );

    const OfflineBanner = () =>
        online === false ? (
            <View style={styles.offlineBanner}>
                <Text style={styles.offlineBannerTxt}>📵 No internet — all messages travel directly via BLE mesh between devices.</Text>
            </View>
        ) : null;

    // ── Peer count pill for header ──────────────────────────────
    const peerLabel =
        peerCount === 0 ? '0 peers connected · BLE mesh' :
            peerCount === 1 ? '1 peer connected · BLE mesh' :
                `${peerCount} peers connected · BLE mesh`;

    // ═══════════════════════════════════════════════════════════
    // CONTACTS LIST
    // ═══════════════════════════════════════════════════════════
    if (screen === 'list') {
        return (
            <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                        <BackIcon />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Mesh Chat</Text>
                        <Text style={styles.headerSub}>Works offline · No internet needed</Text>
                    </View>
                    <OnlineBadge />
                </View>

                <OfflineBanner />

                {/* Info card */}
                <View style={styles.infoCard}>
                    <Text style={{ fontSize: 26 }}>💬</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.infoTitle}>Chat with nearby people</Text>
                        <Text style={styles.infoSub}>
                            Mesh Group Chat works with anyone nearby.{'\n'}
                            Private chats work offline via BLE mesh too.
                        </Text>
                    </View>
                </View>

                {/* Mesh Group Chat — always visible */}
                <TouchableOpacity
                    style={[styles.contactCard, { borderLeftWidth: 3, borderLeftColor: C.orange, marginHorizontal: 16, marginBottom: 4 }]}
                    onPress={() => openChat(meshGroupContact)}
                    activeOpacity={0.8}
                >
                    <View style={[styles.avatar, { backgroundColor: 'rgba(230,81,0,0.12)' }]}>
                        <Text style={{ fontSize: 20 }}>📡</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.contactName, { color: C.orange }]}>Mesh Group Chat</Text>
                        <Text style={styles.contactMeta}>
                            {peerCount > 0
                                ? `${peerCount} peer${peerCount === 1 ? '' : 's'} connected — works offline`
                                : 'Turn on mesh first to chat with nearby users'}
                        </Text>
                    </View>
                    <View style={styles.arrowWrap}>
                        <Text style={[styles.arrowText, { color: C.orange }]}>→</Text>
                    </View>
                </TouchableOpacity>

                {/* Trusted contacts (private chats) */}
                {contacts.length === 0 ? (
                    <View style={[styles.empty, { marginTop: 8 }]}>
                        <Text style={{ fontSize: 32, textAlign: 'center' }}>👥</Text>
                        <Text style={styles.emptyTitle}>No Private Contacts Yet</Text>
                        <Text style={styles.emptySub}>Use Mesh Group Chat above to talk to nearby users right now. Add contacts for private encrypted chats.</Text>
                        <TouchableOpacity
                            style={styles.addBtn}
                            onPress={() => (navigation as any).navigate('ContactsManager')}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.addBtnText}>+ Add Contacts</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={contacts}
                        keyExtractor={c => c.id}
                        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.contactCard} onPress={() => openChat(item)} activeOpacity={0.8}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{initials(item.name)}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.contactName}>{item.name}</Text>
                                    <Text style={styles.contactMeta}>{item.relationship} · {item.phone}</Text>
                                </View>
                                <View style={styles.arrowWrap}>
                                    <Text style={styles.arrowText}>→</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                )}
            </SafeAreaView>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // CHAT CONVERSATION
    // ═══════════════════════════════════════════════════════════
    const isGroupChat = activeContact?.id === MESH_GROUP_ID;

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => {
                            setScreen('list');
                            // Clear private-chat poll timer on back to prevent ghost interval
                            if (pollRef.current) {
                                clearInterval(pollRef.current);
                                pollRef.current = null;
                            }
                        }}
                        activeOpacity={0.7}
                    >
                        <BackIcon />
                    </TouchableOpacity>
                    <View style={[styles.avatar, { width: 38, height: 38, borderRadius: 11, backgroundColor: isGroupChat ? 'rgba(230,81,0,0.12)' : undefined }]}>
                        <Text style={[styles.avatarText, isGroupChat ? { color: C.orange } : {}]}>
                            {isGroupChat ? '📡' : initials(activeContact?.name ?? '?')}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{activeContact?.name}</Text>
                        <Text style={styles.headerSub}>
                            {isGroupChat
                                ? peerLabel
                                : `${activeContact?.relationship} · ${activeContact?.phone}`}
                        </Text>
                    </View>
                    <OnlineBadge />
                </View>

                <OfflineBanner />

                {/* Messages */}
                <FlatList
                    ref={flatRef}
                    data={messages}
                    keyExtractor={m => m.id}
                    contentContainerStyle={styles.msgList}
                    ListEmptyComponent={
                        <View style={styles.emptyChat}>
                            <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>
                                {isGroupChat ? '📡' : '👋'}
                            </Text>
                            <Text style={styles.emptyChatTitle}>Start the conversation</Text>
                            <Text style={styles.emptyChatSub}>
                                {isGroupChat
                                    ? 'Messages go to all connected mesh peers instantly. No internet needed.'
                                    : `Messages save on your phone and are sent via BLE mesh.\nDelivered even without internet!`}
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const isMe = item.senderId === userId;
                        return (
                            <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
                                {!isMe && (
                                    <View style={styles.bubbleAvatar}>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: C.blue }}>{initials(item.senderName)}</Text>
                                    </View>
                                )}
                                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                                    <Text style={[styles.bubbleTxt, isMe && { color: C.white }]}>{item.text}</Text>
                                    <View style={styles.bubbleMeta}>
                                        <Text style={[styles.bubbleTime, isMe && { color: 'rgba(255,255,255,0.65)' }]}>
                                            {formatTime(item.createdAt)}
                                        </Text>
                                        {isMe && (
                                            <Text style={[styles.tick, item.status === 'delivered' && styles.tickDelivered]}>
                                                {tickIcon(item.status)}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        );
                    }}
                />

                {/* Input */}
                <View style={styles.inputBar}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor={C.muted}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                        returnKeyType="send"
                        onSubmitEditing={sendMessage}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnOff]}
                        onPress={sendMessage}
                        activeOpacity={0.8}
                        disabled={!inputText.trim() || sending}
                    >
                        <SendIcon />
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// ─── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.bg, paddingBottom: 16 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: C.brown, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: C.brown, letterSpacing: -0.4 },
    headerSub: { fontSize: 12, color: C.muted, marginTop: 1, fontWeight: '500' },
    badge: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    offlineBanner: { backgroundColor: 'rgba(230,81,0,0.10)', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(230,81,0,0.20)' },
    offlineBannerTxt: { fontSize: 12, color: C.offline, fontWeight: '600', lineHeight: 18 },

    infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, margin: 16, padding: 16, backgroundColor: C.white, borderRadius: 20, shadowColor: C.brown, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
    infoTitle: { fontSize: 14, fontWeight: '800', color: C.brown, marginBottom: 4, letterSpacing: -0.3 },
    infoSub: { fontSize: 12, color: C.muted, lineHeight: 18 },

    contactCard: { backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: C.brown, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 16, fontWeight: '800', color: C.green },
    contactName: { fontSize: 16, fontWeight: '800', color: C.brown, letterSpacing: -0.3 },
    contactMeta: { fontSize: 12, color: C.muted, marginTop: 2, fontWeight: '500' },
    arrowWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    arrowText: { fontSize: 16, color: C.muted, fontWeight: '700' },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: C.brown, marginTop: 12, marginBottom: 6 },
    emptySub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },
    addBtn: { marginTop: 20, backgroundColor: C.orange, borderRadius: 100, paddingHorizontal: 24, paddingVertical: 12 },
    addBtnText: { fontSize: 14, fontWeight: '700', color: C.white },

    msgList: { padding: 16, paddingBottom: 24, flexGrow: 1 },
    emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 20 },
    emptyChatTitle: { fontSize: 18, fontWeight: '800', color: C.brown, marginBottom: 8, letterSpacing: -0.3 },
    emptyChatSub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 22, fontWeight: '500' },

    bubbleRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
    bubbleRowMe: { flexDirection: 'row-reverse' },
    bubbleAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    bubble: { maxWidth: '78%', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, shadowColor: C.brown, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
    bubbleMe: { backgroundColor: C.bubbleMe, borderBottomRightRadius: 4 },
    bubbleThem: { backgroundColor: C.bubbleThem, borderBottomLeftRadius: 4 },
    bubbleTxt: { fontSize: 15, color: C.brown, lineHeight: 22 },
    bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, justifyContent: 'flex-end' },
    bubbleTime: { fontSize: 10, color: C.muted, fontWeight: '600' },
    tick: { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '800' },
    tickDelivered: { color: '#A7F3D0' },

    inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.bg, paddingBottom: Platform.OS === 'ios' ? 24 : 14 },
    input: { flex: 1, backgroundColor: C.white, borderRadius: 24, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, fontSize: 15, color: C.brown, maxHeight: 120, shadowColor: C.brown, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
    sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    sendBtnOff: { backgroundColor: 'rgba(44,26,14,0.1)', shadowOpacity: 0, elevation: 0 },
});

export default MeshChatScreen;
