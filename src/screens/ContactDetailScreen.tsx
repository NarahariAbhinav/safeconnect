/**
 * ContactDetailScreen — Emergency communication hub for a trusted contact
 *
 * Features:
 *  • Premium chat UI with message bubbles (text / voice / location / file)
 *  • Text messaging with send
 *  • 🎤 Voice recording (expo-av) — tap & hold to record, release to send
 *  • 📍 Location sharing — sends current GPS + address as a location card
 *  • 📎 File sharing (expo-document-picker)
 *  • 📞 Call button — disabled with "Coming soon with Mesh Network" label
 *  • Long-press message → delete
 */

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Linking,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Vibration,
    View,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { TrustedContact, contactsService } from '../services/contacts';
import { locationService } from '../services/location';
import {
    Message,
    formatDuration,
    formatFileSize,
    formatMessageTime,
    messagesService,
} from '../services/messages';

// ─── Colors ──────────────────────────────────────────────────────────
const C = {
    bg: '#EBF4F7',
    orange: '#E05A2B',
    orangeLight: 'rgba(224,90,43,0.10)',
    brown: '#2C1A0E',
    brownMid: '#5C3D25',
    muted: '#8C7060',
    white: '#FFFFFF',
    card: 'rgba(255,255,255,0.95)',
    border: 'rgba(44,26,14,0.08)',
    green: '#2A7A5A',
    greenLight: 'rgba(42,122,90,0.12)',
    red: '#D32F2F',
    redLight: 'rgba(211,47,47,0.10)',
    blue: '#1565C0',
    blueLight: 'rgba(21,101,192,0.10)',
    amber: '#E65100',
    amberLight: 'rgba(230,81,0,0.10)',
    myBubble: '#E05A2B',
    theirBubble: '#FFFFFF',
    headerFrom: '#2C1A0E',
    headerTo: '#3D2410',
};

// ─── Icons ────────────────────────────────────────────────────────────
const BackIcon = () => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M12 19l-7-7 7-7" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const SendIcon = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const MicIcon: React.FC<{ color?: string }> = ({ color = C.muted }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Rect x="9" y="2" width="6" height="11" rx="3" stroke={color} strokeWidth="1.8" fill="none" />
        <Path d="M5 10a7 7 0 0014 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <Line x1="12" y1="19" x2="12" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Line x1="8" y1="22" x2="16" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
);
const LocationPinIcon: React.FC<{ color?: string }> = ({ color = C.orange }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={color} strokeWidth="1.8" fill={color + '22'} />
        <Circle cx="12" cy="9" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
    </Svg>
);
const FileIcon: React.FC<{ color?: string }> = ({ color = C.blue }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth="1.8" fill={color + '18'} />
        <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
);
const CallIcon: React.FC<{ color?: string }> = ({ color = C.muted }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" stroke={color} strokeWidth="1.8" fill="none" />
    </Svg>
);
const PhoneCallIcon: React.FC<{ color?: string }> = ({ color = C.white }) => (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <Path d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" stroke={color} strokeWidth="1.8" fill="none" />
    </Svg>
);
const TrashIcon = () => (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={C.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const PlayIcon: React.FC<{ color?: string }> = ({ color = C.white }) => (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <Path d="M5 3l14 9-14 9V3z" fill={color} />
    </Svg>
);
const MapIcon = () => (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <Path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" stroke={C.white} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </Svg>
);

// ─── Voice waveform animation ─────────────────────────────────────────
const VoiceWaveform: React.FC<{ isPlaying: boolean; color?: string }> = ({ isPlaying, color = C.white }) => {
    const heights = [0.4, 0.7, 1.0, 0.6, 0.85, 0.5, 0.75, 0.45, 0.9, 0.55];
    const anims = heights.map(() => useSharedValue(0));

    useEffect(() => {
        if (isPlaying) {
            anims.forEach((a, i) => {
                a.value = withRepeat(
                    withSequence(
                        withTiming(1, { duration: 300 + i * 50 }),
                        withTiming(0.2, { duration: 300 + i * 50 })
                    ),
                    -1, true
                );
            });
        } else {
            anims.forEach((a, i) => { a.value = withTiming(heights[i], { duration: 200 }); });
        }
    }, [isPlaying]);

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 }}>
            {anims.map((anim, i) => {
                const style = useAnimatedStyle(() => ({
                    height: 24 * (isPlaying ? anim.value : heights[i]),
                    width: 3,
                    borderRadius: 2,
                    backgroundColor: color,
                    opacity: 0.85,
                }));
                return <Animated.View key={i} style={style} />;
            })}
        </View>
    );
};

// ─── Message Bubble ───────────────────────────────────────────────────
interface BubbleProps {
    msg: Message;
    onLongPress: () => void;
    onPlayVoice: () => void;
    playingId: string | null;
}

const MessageBubble: React.FC<BubbleProps> = ({ msg, onLongPress, onPlayVoice, playingId }) => {
    const isMe = msg.fromMe;
    const isPlaying = playingId === msg.id;
    const time = formatMessageTime(msg.sentAt);

    const bubbleColor = isMe ? C.myBubble : C.theirBubble;
    const textColor = isMe ? C.white : C.brown;
    const subColor = isMe ? 'rgba(255,255,255,0.7)' : C.muted;

    return (
        <TouchableWithoutFeedback onLongPress={onLongPress}>
            <Animated.View
                entering={FadeInUp.duration(250)}
                style={[
                    bubbleStyles.wrap,
                    isMe ? bubbleStyles.wrapMe : bubbleStyles.wrapThem,
                ]}
            >
                {/* ── TEXT ── */}
                {msg.type === 'text' && (
                    <View style={[bubbleStyles.bubble, { backgroundColor: bubbleColor }, isMe ? bubbleStyles.bubbleMe : bubbleStyles.bubbleThem]}>
                        <Text style={[bubbleStyles.bodyText, { color: textColor }]}>{msg.text}</Text>
                        <Text style={[bubbleStyles.timeText, { color: subColor }]}>{time}</Text>
                    </View>
                )}

                {/* ── VOICE ── */}
                {msg.type === 'voice' && (
                    <View style={[bubbleStyles.bubble, { backgroundColor: bubbleColor, minWidth: 180 }, isMe ? bubbleStyles.bubbleMe : bubbleStyles.bubbleThem]}>
                        <View style={bubbleStyles.voiceRow}>
                            <TouchableOpacity
                                style={[bubbleStyles.playBtn, { backgroundColor: isMe ? 'rgba(255,255,255,0.25)' : C.orangeLight }]}
                                onPress={onPlayVoice}
                                activeOpacity={0.8}
                            >
                                <PlayIcon color={isMe ? C.white : C.orange} />
                            </TouchableOpacity>
                            <VoiceWaveform isPlaying={isPlaying} color={isMe ? C.white : C.orange} />
                            <Text style={[bubbleStyles.durationText, { color: subColor }]}>
                                {formatDuration(msg.voice?.durationSec ?? 0)}
                            </Text>
                        </View>
                        <Text style={[bubbleStyles.timeText, { color: subColor, marginTop: 4 }]}>{time}</Text>
                    </View>
                )}

                {/* ── LOCATION ── */}
                {msg.type === 'location' && (
                    <TouchableOpacity
                        style={[bubbleStyles.bubble, { backgroundColor: bubbleColor, padding: 0, overflow: 'hidden' }, isMe ? bubbleStyles.bubbleMe : bubbleStyles.bubbleThem]}
                        activeOpacity={0.85}
                        onPress={() => {
                            if (msg.location) {
                                Linking.openURL(
                                    `https://maps.google.com/?q=${msg.location.latitude},${msg.location.longitude}`
                                );
                            }
                        }}
                    >
                        {/* Map placeholder */}
                        <View style={[bubbleStyles.mapPreview, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : C.orangeLight }]}>
                            <View style={{ opacity: 0.8 }}>
                                <LocationPinIcon color={isMe ? C.white : C.orange} />
                            </View>
                            <Text style={[bubbleStyles.mapCoords, { color: isMe ? C.white : C.orange }]}>
                                📍 Live Location
                            </Text>
                        </View>
                        <View style={{ padding: 10 }}>
                            <Text style={[bubbleStyles.locationAddress, { color: textColor }]} numberOfLines={2}>
                                {msg.location?.address ?? `${msg.location?.latitude?.toFixed(5)}, ${msg.location?.longitude?.toFixed(5)}`}
                            </Text>
                            <View style={bubbleStyles.mapOpenRow}>
                                <MapIcon />
                                <Text style={[bubbleStyles.mapOpenText, { color: subColor }]}>Tap to open in Maps</Text>
                                <Text style={[bubbleStyles.timeText, { color: subColor }]}>{time}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}

                {/* ── FILE ── */}
                {msg.type === 'file' && (
                    <TouchableOpacity
                        style={[bubbleStyles.bubble, { backgroundColor: bubbleColor }, isMe ? bubbleStyles.bubbleMe : bubbleStyles.bubbleThem]}
                        activeOpacity={0.85}
                        onPress={() => msg.file?.uri && Linking.openURL(msg.file.uri)}
                    >
                        <View style={bubbleStyles.fileRow}>
                            <View style={[bubbleStyles.fileIconWrap, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : C.blueLight }]}>
                                <FileIcon color={isMe ? C.white : C.blue} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[bubbleStyles.fileName, { color: textColor }]} numberOfLines={1}>
                                    {msg.file?.name ?? 'File'}
                                </Text>
                                <Text style={[bubbleStyles.fileSize, { color: subColor }]}>
                                    {formatFileSize(msg.file?.sizeBytes ?? 0)} · {msg.file?.mimeType?.split('/')[1]?.toUpperCase() ?? 'FILE'}
                                </Text>
                            </View>
                        </View>
                        <Text style={[bubbleStyles.timeText, { color: subColor, marginTop: 6 }]}>{time}</Text>
                    </TouchableOpacity>
                )}
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

const bubbleStyles = StyleSheet.create({
    wrap: { marginBottom: 6, maxWidth: '78%' },
    wrapMe: { alignSelf: 'flex-end' },
    wrapThem: { alignSelf: 'flex-start' },
    bubble: {
        borderRadius: 18, padding: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    },
    bubbleMe: { borderBottomRightRadius: 4 },
    bubbleThem: { borderBottomLeftRadius: 4 },
    bodyText: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
    timeText: { fontSize: 10, fontWeight: '500', alignSelf: 'flex-end', marginTop: 3 },

    // Voice
    voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    playBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    durationText: { fontSize: 11, fontWeight: '600', minWidth: 32 },

    // Location
    mapPreview: { height: 90, alignItems: 'center', justifyContent: 'center', gap: 6 },
    mapCoords: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
    locationAddress: { fontSize: 12, fontWeight: '600', lineHeight: 18, marginBottom: 4 },
    mapOpenRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    mapOpenText: { fontSize: 10, fontWeight: '500', flex: 1 },

    // File
    fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    fileIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    fileName: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
    fileSize: { fontSize: 10, fontWeight: '500', marginTop: 2 },
});

// ─── Recording indicator ──────────────────────────────────────────────
const RecordingIndicator: React.FC<{ seconds: number }> = ({ seconds }) => {
    const scale = useSharedValue(1);
    useEffect(() => {
        scale.value = withRepeat(withSequence(
            withTiming(1.2, { duration: 500 }),
            withTiming(1, { duration: 500 }),
        ), -1, false);
    }, []);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
        <View style={recStyles.wrap}>
            <Animated.View style={[recStyles.dot, style]} />
            <Text style={recStyles.text}>Recording {formatDuration(seconds)}</Text>
            <Text style={recStyles.hint}>Release to send • Swipe up to cancel</Text>
        </View>
    );
};

const recStyles = StyleSheet.create({
    wrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.red },
    text: { fontSize: 14, fontWeight: '700', color: C.brown },
    hint: { fontSize: 11, color: C.muted, flex: 1, textAlign: 'right' },
});

// ─── Main Screen ──────────────────────────────────────────────────────
type ParamList = { ContactDetail: { contactId: string } };
type Props = NativeStackScreenProps<ParamList, 'ContactDetail'>;


const ContactDetailScreen: React.FC<Props> = ({ navigation, route }) => {
    const { contactId } = route.params;

    const [contact, setContact] = useState<TrustedContact | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSec, setRecordingSec] = useState(0);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [isSendingLocation, setIsSendingLocation] = useState(false);

    const flatRef = useRef<FlatList>(null);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);

    // ── Load contact + messages ──
    useEffect(() => {
        contactsService.getTrusted().then(list => {
            setContact(list.find(c => c.id === contactId) ?? null);
        });
        messagesService.getMessages(contactId).then(setMessages);
    }, [contactId]);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages]);

    // ── Send text ──
    const sendText = async () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setText('');
        const msg = await messagesService.sendMessage({
            contactId,
            type: 'text',
            fromMe: true,
            text: trimmed,
        });
        setMessages(prev => [...prev, msg]);
    };

    // ── Voice recording ──
    const startRecording = async () => {
        try {
            const { granted } = await Audio.requestPermissionsAsync();
            if (!granted) {
                Alert.alert('Microphone Permission', 'Please allow microphone access to send voice messages.');
                return;
            }
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            recordingRef.current = recording;
            setIsRecording(true);
            setRecordingSec(0);
            Vibration.vibrate(50);
            recordingTimer.current = setInterval(() => setRecordingSec(s => s + 1), 1000);
        } catch (e) {
            Alert.alert('Recording failed', 'Could not start recording.');
        }
    };

    const stopRecording = async (cancelled = false) => {
        if (!recordingRef.current) return;
        clearInterval(recordingTimer.current!);
        const duration = recordingSec;
        setIsRecording(false);
        setRecordingSec(0);

        try {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;

            if (cancelled || !uri || duration < 1) return;

            const msg = await messagesService.sendMessage({
                contactId,
                type: 'voice',
                fromMe: true,
                voice: { uri, durationSec: duration },
            });
            setMessages(prev => [...prev, msg]);
        } catch { /* ignore */ }
    };

    // ── Play voice ──
    const togglePlayVoice = async (msg: Message) => {
        if (!msg.voice?.uri) return;
        if (playingId === msg.id) {
            // Stop
            await soundRef.current?.stopAsync();
            setPlayingId(null);
            return;
        }
        try {
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }
            const { sound } = await Audio.Sound.createAsync({ uri: msg.voice.uri });
            soundRef.current = sound;
            setPlayingId(msg.id);
            await sound.playAsync();
            sound.setOnPlaybackStatusUpdate((status: { isLoaded: boolean; didJustFinish?: boolean }) => {
                if (status.isLoaded && status.didJustFinish) {
                    setPlayingId(null);
                }
            });
        } catch {
            setPlayingId(null);
        }
    };

    // ── Send location ──
    const sendLocation = async () => {
        setIsSendingLocation(true);
        try {
            const hasPermission = await locationService.checkLocationPermission();
            if (!hasPermission) {
                Alert.alert('Location Permission', 'Please grant location access in Settings.');
                return;
            }
            const loc = await locationService.getCurrentLocation();
            if (!loc) { Alert.alert('Could not get location', 'Please try again.'); return; }
            const address = await locationService.getAddressFromCoordinates(loc.latitude, loc.longitude);
            const msg = await messagesService.sendMessage({
                contactId,
                type: 'location',
                fromMe: true,
                location: {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    address: address ?? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`,
                },
            });
            setMessages(prev => [...prev, msg]);
        } catch {
            Alert.alert('Error', 'Failed to get your location. Try again.');
        } finally {
            setIsSendingLocation(false);
        }
    };

    // ── Share file ──
    const pickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });
            if (result.canceled) return;
            const asset = result.assets[0];
            const msg = await messagesService.sendMessage({
                contactId,
                type: 'file',
                fromMe: true,
                file: {
                    uri: asset.uri,
                    name: asset.name,
                    sizeBytes: asset.size ?? 0,
                    mimeType: asset.mimeType ?? 'application/octet-stream',
                },
            });
            setMessages(prev => [...prev, msg]);
        } catch { /* cancelled */ }
    };

    // ── Share image ──
    const pickImage = async () => {
        const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!granted) {
            Alert.alert('Photo Permission', 'Please allow access to your photos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        const msg = await messagesService.sendMessage({
            contactId,
            type: 'file',
            fromMe: true,
            file: {
                uri: asset.uri,
                name: asset.fileName ?? 'image.jpg',
                sizeBytes: asset.fileSize ?? 0,
                mimeType: asset.mimeType ?? 'image/jpeg',
            },
        });
        setMessages(prev => [...prev, msg]);
    };

    // ── Delete message ──
    const deleteMsg = (msg: Message) => {
        Alert.alert('Delete Message', 'Remove this message?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const updated = await messagesService.deleteMessage(contactId, msg.id);
                    setMessages(updated);
                },
            },
        ]);
    };

    // ── File picker sheet ──
    const showFileOptions = () => {
        Alert.alert('Share File', 'Choose what to share:', [
            { text: '📷 Photo / Image', onPress: pickImage },
            { text: '📄 Document / File', onPress: pickFile },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const initials = contact ? contactsService.getInitials(contact.name) : '?';

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <BackIcon />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <View style={[styles.headerAvatar, { backgroundColor: contact?.avatarColor ?? C.orange }]}>
                        <Text style={styles.headerAvatarText}>{initials}</Text>
                    </View>
                    <View>
                        <Text style={styles.headerName}>{contact?.name ?? 'Contact'}</Text>
                        <Text style={styles.headerRel}>{contact?.relationship ?? ''}</Text>
                    </View>
                </View>

                {/* Direct call via phone (not mesh) */}
                <TouchableOpacity
                    style={styles.callNativeBtn}
                    onPress={() => {
                        if (contact?.phone) {
                            Linking.openURL(`tel:${contact.phone}`);
                        }
                    }}
                    activeOpacity={0.8}
                >
                    <PhoneCallIcon />
                </TouchableOpacity>
            </View>

            {/* ── Messages ── */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <FlatList
                    ref={flatRef}
                    data={messages}
                    keyExtractor={m => m.id}
                    contentContainerStyle={styles.msgList}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={scrollToBottom}
                    ListEmptyComponent={
                        <View style={styles.emptyMsgWrap}>
                            <Text style={styles.emptyMsgEmoji}>🔒</Text>
                            <Text style={styles.emptyMsgTitle}>Secure Channel Ready</Text>
                            <Text style={styles.emptyMsgSub}>
                                Messages, voice clips, location, and files{'\n'}shared here stay on your device.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <MessageBubble
                            msg={item}
                            onLongPress={() => deleteMsg(item)}
                            onPlayVoice={() => togglePlayVoice(item)}
                            playingId={playingId}
                        />
                    )}
                />

                {/* ── Action Bar ── */}
                <View style={styles.actionBar}>
                    {/* Quick actions row */}
                    <View style={styles.quickActionsRow}>
                        {/* 📍 Location */}
                        <TouchableOpacity
                            style={[styles.quickBtn, { backgroundColor: C.orangeLight }]}
                            onPress={sendLocation}
                            activeOpacity={0.75}
                            disabled={isSendingLocation}
                        >
                            <LocationPinIcon color={C.orange} />
                            <Text style={[styles.quickBtnLabel, { color: C.orange }]}>
                                {isSendingLocation ? '...' : 'Location'}
                            </Text>
                        </TouchableOpacity>

                        {/* 🎤 Voice — hold to record */}
                        <TouchableOpacity
                            style={[styles.quickBtn, { backgroundColor: isRecording ? C.redLight : C.greenLight }]}
                            onPressIn={startRecording}
                            onPressOut={() => stopRecording(false)}
                            activeOpacity={0.75}
                        >
                            <MicIcon color={isRecording ? C.red : C.green} />
                            <Text style={[styles.quickBtnLabel, { color: isRecording ? C.red : C.green }]}>
                                {isRecording ? 'Release' : 'Voice'}
                            </Text>
                        </TouchableOpacity>

                        {/* 📎 File */}
                        <TouchableOpacity
                            style={[styles.quickBtn, { backgroundColor: C.blueLight }]}
                            onPress={showFileOptions}
                            activeOpacity={0.75}
                        >
                            <FileIcon color={C.blue} />
                            <Text style={[styles.quickBtnLabel, { color: C.blue }]}>Files</Text>
                        </TouchableOpacity>

                        {/* 📞 Mesh Call — Coming Soon */}
                        <TouchableOpacity
                            style={[styles.quickBtn, { backgroundColor: 'rgba(44,26,14,0.06)' }]}
                            activeOpacity={0.6}
                            onPress={() =>
                                Alert.alert(
                                    '📡 Mesh Call — Coming Soon',
                                    'Voice & video calls over the offline mesh network will be available once BLE networking is live.',
                                    [{ text: 'Got it' }]
                                )
                            }
                        >
                            <CallIcon color={C.muted} />
                            <Text style={[styles.quickBtnLabel, { color: C.muted }]}>Call</Text>
                            <View style={styles.soonBadge}>
                                <Text style={styles.soonBadgeText}>SOON</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Text input row */}
                    {isRecording ? (
                        <RecordingIndicator seconds={recordingSec} />
                    ) : (
                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.input}
                                placeholder="Type an emergency message..."
                                placeholderTextColor={C.muted}
                                value={text}
                                onChangeText={setText}
                                multiline
                                maxLength={1000}
                                returnKeyType="default"
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
                                onPress={sendText}
                                activeOpacity={0.82}
                                disabled={!text.trim()}
                            >
                                <SendIcon />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: C.bg },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: C.brown, paddingHorizontal: 14, paddingVertical: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 11,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginHorizontal: 10 },
    headerAvatar: {
        width: 40, height: 40, borderRadius: 13,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    },
    headerAvatarText: { fontSize: 15, fontWeight: '800', color: C.white },
    headerName: { fontSize: 16, fontWeight: '800', color: C.white, letterSpacing: -0.3 },
    headerRel: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginTop: 1 },
    callNativeBtn: {
        width: 38, height: 38, borderRadius: 11,
        backgroundColor: C.green,
        alignItems: 'center', justifyContent: 'center',
    },

    // Messages
    msgList: { paddingHorizontal: 14, paddingVertical: 16, paddingBottom: 8 },
    emptyMsgWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 32 },
    emptyMsgEmoji: { fontSize: 48, marginBottom: 14 },
    emptyMsgTitle: { fontSize: 18, fontWeight: '800', color: C.brown, letterSpacing: -0.4, marginBottom: 8, textAlign: 'center' },
    emptyMsgSub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },

    // Action bar
    actionBar: {
        backgroundColor: C.white,
        borderTopWidth: 1, borderTopColor: C.border,
        paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 4 : 8,
        paddingHorizontal: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 6,
    },
    quickActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    quickBtn: {
        flex: 1, borderRadius: 12, paddingVertical: 9,
        alignItems: 'center', justifyContent: 'center', gap: 4,
        position: 'relative',
    },
    quickBtnLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.1 },
    soonBadge: {
        position: 'absolute', top: 4, right: 4,
        backgroundColor: C.muted, borderRadius: 4,
        paddingHorizontal: 4, paddingVertical: 1,
    },
    soonBadgeText: { fontSize: 7, fontWeight: '800', color: C.white, letterSpacing: 0.5 },

    // Input row
    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    },
    input: {
        flex: 1, backgroundColor: C.bg,
        borderWidth: 1.5, borderColor: C.border,
        borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
        fontSize: 14, color: C.brown, maxHeight: 100,
        fontWeight: '500',
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: C.orange,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: C.orange, shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    sendBtnDisabled: {
        backgroundColor: 'rgba(44,26,14,0.15)',
        shadowOpacity: 0, elevation: 0,
    },
});

export default ContactDetailScreen;
