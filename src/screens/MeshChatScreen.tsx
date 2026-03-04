/**
 * MeshChatScreen.tsx — Offline-first Chat
 * Clean rewrite — no View naming conflicts
 */

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { bleMeshService } from '../services/ble/BLEMeshService';
import { ChatMessage, chatService } from '../services/chatService';
import { contactsService, TrustedContact } from '../services/contacts';

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

type Params = { MeshChat: { userId: string; userName: string } };
type Props = NativeStackScreenProps<Params, 'MeshChat'>;

const MeshChatScreen: React.FC<Props> = ({ navigation, route }) => {
    const { userId, userName } = route.params;

    const [screen, setScreen] = useState<'list' | 'chat'>('list');
    const [contacts, setContacts] = useState<TrustedContact[]>([]);
    const [activeContact, setContact] = useState<TrustedContact | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [online, setOnline] = useState<boolean | null>(null);
    const flatRef = useRef<FlatList<ChatMessage>>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Load contacts ──────────────────────────────────────────
    useEffect(() => {
        contactsService.getTrusted().then(setContacts);
    }, []);

    // ── Connectivity check ─────────────────────────────────────
    useEffect(() => {
        const ping = () =>
            fetch('https://www.google.com/generate_204', { method: 'HEAD', cache: 'no-cache' })
                .then(r => setOnline(r.ok || r.status === 204))
                .catch(() => setOnline(false));
        ping();
        const t = setInterval(ping, 10_000);
        return () => clearInterval(t);
    }, []);

    // ── Open chat ──────────────────────────────────────────────
    const openChat = useCallback(async (contact: TrustedContact) => {
        setContact(contact);
        setMessages([]);
        setScreen('chat');
        const msgs = await chatService.getMessages(userId, contact.id);
        setMessages(msgs);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            const lastTs = msgs[msgs.length - 1]?.createdAt ?? 0;
            const fresh = await chatService.pollNewMessages(userId, contact.id, lastTs);
            if (fresh.length > 0) {
                setMessages(prev => {
                    const ids = new Set(prev.map(m => m.id));
                    const merged = [...prev, ...fresh.filter(m => !ids.has(m.id))].sort((a, b) => a.createdAt - b.createdAt);
                    return merged;
                });
                setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
            }
        }, 5000);
    }, [userId]);

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

    // ── Send ───────────────────────────────────────────────────
    const sendMessage = async () => {
        if (!inputText.trim() || !activeContact || sending) return;
        const text = inputText.trim();
        setInputText('');
        setSending(true);
        const msg = await chatService.sendMessage(userId, userName, activeContact.id, activeContact.name, text);
        setMessages(prev => [...prev, msg]);

        // Also broadcast via BLE mesh for offline delivery
        if (bleMeshService.ready) {
            try {
                const pkt = bleMeshService.createChatPacket(userId, msg.roomId, msg);
                await bleMeshService.broadcast(pkt);
                console.log('[MeshChat] Message broadcast via BLE mesh');
            } catch (e) {
                console.log('[MeshChat] BLE broadcast skipped');
            }
        }

        setSending(false);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
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
                <Text style={styles.offlineBannerTxt}>📵 No internet — messages saved locally. Delivered when signal returns.</Text>
            </View>
        ) : null;

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
                        <Text style={styles.infoTitle}>Chat with your trusted contacts</Text>
                        <Text style={styles.infoSub}>
                            Messages save instantly on your phone.{'\n'}
                            Sync to their phone when either of you has internet.
                        </Text>
                    </View>
                </View>

                {/* Contacts */}
                {contacts.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={{ fontSize: 48, textAlign: 'center' }}>👥</Text>
                        <Text style={styles.emptyTitle}>No Contacts Yet</Text>
                        <Text style={styles.emptySub}>Add trusted contacts from the Home screen first.</Text>
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
    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => { setScreen('list'); if (pollRef.current) clearInterval(pollRef.current); }} activeOpacity={0.7}>
                        <BackIcon />
                    </TouchableOpacity>
                    <View style={[styles.avatar, { width: 38, height: 38, borderRadius: 11 }]}>
                        <Text style={styles.avatarText}>{initials(activeContact?.name ?? '?')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{activeContact?.name}</Text>
                        <Text style={styles.headerSub}>{activeContact?.relationship} · {activeContact?.phone}</Text>
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
                            <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>👋</Text>
                            <Text style={styles.emptyChatTitle}>Start the conversation</Text>
                            <Text style={styles.emptyChatSub}>
                                Messages save on your phone instantly.{'\n'}
                                Delivered to {activeContact?.name} when either of you has internet.
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
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
    backBtn: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(44,26,14,0.06)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800', color: C.brown },
    headerSub: { fontSize: 11, color: C.muted, marginTop: 1 },
    badge: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    offlineBanner: { backgroundColor: 'rgba(230,81,0,0.10)', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(230,81,0,0.20)' },
    offlineBannerTxt: { fontSize: 12, color: C.offline, fontWeight: '600', lineHeight: 18 },

    infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, margin: 16, padding: 14, backgroundColor: C.blueLight, borderWidth: 1.5, borderColor: 'rgba(21,101,192,0.20)', borderRadius: 14 },
    infoTitle: { fontSize: 13, fontWeight: '800', color: C.blue, marginBottom: 4 },
    infoSub: { fontSize: 11, color: C.muted, lineHeight: 18 },

    contactCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 15, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 16, fontWeight: '800', color: C.green },
    contactName: { fontSize: 15, fontWeight: '700', color: C.brown },
    contactMeta: { fontSize: 11, color: C.muted, marginTop: 2 },
    arrowWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
    arrowText: { fontSize: 16, color: C.green, fontWeight: '700' },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: C.brown, marginTop: 12, marginBottom: 6 },
    emptySub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },
    addBtn: { marginTop: 20, backgroundColor: C.orange, borderRadius: 100, paddingHorizontal: 24, paddingVertical: 12 },
    addBtnText: { fontSize: 14, fontWeight: '700', color: C.white },

    msgList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
    emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    emptyChatTitle: { fontSize: 16, fontWeight: '800', color: C.brown, marginBottom: 8 },
    emptyChatSub: { fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 20 },

    bubbleRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', gap: 8 },
    bubbleRowMe: { flexDirection: 'row-reverse' },
    bubbleAvatar: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleMe: { backgroundColor: C.bubbleMe, borderBottomRightRadius: 4 },
    bubbleThem: { backgroundColor: C.bubbleThem, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
    bubbleTxt: { fontSize: 14, color: C.brown, lineHeight: 20 },
    bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' },
    bubbleTime: { fontSize: 10, color: C.muted },
    tick: { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
    tickDelivered: { color: '#90EE90' },

    inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
    input: { flex: 1, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.brown, maxHeight: 100 },
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', shadowColor: C.green, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    sendBtnOff: { backgroundColor: 'rgba(44,26,14,0.15)', elevation: 0 },
});

export default MeshChatScreen;
