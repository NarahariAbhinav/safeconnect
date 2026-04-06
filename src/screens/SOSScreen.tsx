/**
 * SOSScreen — Emergency Active Hub
 *
 * Shown when Emergency Mode is activated from HomeScreen.
 * Features:
 *  • Pulsing SOS / Countdown trigger UI
 *  • Auto-sends SMS to all trusted contacts with GPS link
 *  • Shows who was notified + live timer
 *  • "I Need Help" → opens NeedsReportScreen
 *  • "I'm Safe" → deactivates SOS and goes back
 *  • Completely offline — stores locally, syncs when gateway available
 */

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SMS from 'expo-sms';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { batteryService, BatteryState } from '../services/batteryService';
import { bleMeshService } from '../services/ble/BLEMeshService';
import { contactsService, TrustedContact } from '../services/contacts';
import { locationService } from '../services/location';
import { locationTrailService } from '../services/locationTrailService';
import { notificationService } from '../services/notificationService';
import { permissionService } from '../services/permissionService';
import { GovtAction, SOSRecord, sosService } from '../services/sos';
import { soundService } from '../services/soundService';

// ─── Colors ─────────────────────────────────────────────────────────
const C = {
    bg: '#FFF0F0',
    red: '#D32F2F',
    redLight: 'rgba(211,47,47,0.12)',
    redGlow: 'rgba(211,47,47,0.30)',
    orange: '#E05A2B',
    brown: '#2C1A0E',
    muted: '#8C7060',
    white: '#FFFFFF',
    green: '#2A7A5A',
    greenLight: 'rgba(42,122,90,0.12)',
    card: 'rgba(255,255,255,0.95)',
    border: 'rgba(211,47,47,0.15)',
    blue: '#1565C0',
    blueLight: 'rgba(21,101,192,0.10)',
};

// ─── Icons ────────────────────────────────────────────────────────────
const BackIcon = () => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M12 19l-7-7 7-7" stroke={C.brown} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const CheckIcon = () => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Path d="M20 6L9 17l-5-5" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const PhoneIcon = () => (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <Path d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" stroke={C.white} strokeWidth="1.8" fill="none" />
    </Svg>
);
const LocationIcon = () => (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={C.white} strokeWidth="1.8" fill="none" />
        <Circle cx="12" cy="9" r="2.5" stroke={C.white} strokeWidth="1.5" fill="none" />
    </Svg>
);
const AlertIcon = () => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={C.white} strokeWidth="1.8" fill="none" />
        <Line x1="12" y1="9" x2="12" y2="13" stroke={C.white} strokeWidth="2" strokeLinecap="round" />
        <Circle cx="12" cy="17" r="0.5" fill={C.white} stroke={C.white} strokeWidth="1.5" />
    </Svg>
);

// ─── Pulsing SOS ring ────────────────────────────────────────────────
const PulseRing: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    const scale1 = useSharedValue(1);
    const scale2 = useSharedValue(1);
    const opacity1 = useSharedValue(0.6);
    const opacity2 = useSharedValue(0.4);

    useEffect(() => {
        if (isActive) {
            scale1.value = withRepeat(withSequence(
                withTiming(1.8, { duration: 800 }),
                withTiming(1, { duration: 0 }),
            ), -1, false);
            opacity1.value = withRepeat(withSequence(
                withTiming(0, { duration: 800 }),
                withTiming(0.6, { duration: 0 }),
            ), -1, false);
            scale2.value = withRepeat(withSequence(
                withTiming(1, { duration: 400 }),
                withTiming(2.2, { duration: 800 }),
                withTiming(1, { duration: 0 }),
            ), -1, false);
            opacity2.value = withRepeat(withSequence(
                withTiming(0.4, { duration: 400 }),
                withTiming(0, { duration: 800 }),
                withTiming(0.4, { duration: 0 }),
            ), -1, false);
        } else {
            scale1.value = withTiming(1);
            scale2.value = withTiming(1);
            opacity1.value = withTiming(0.6);
            opacity2.value = withTiming(0.4);
        }
    }, [isActive]);

    const ring1Style = useAnimatedStyle(() => ({
        transform: [{ scale: scale1.value }],
        opacity: opacity1.value,
    }));
    const ring2Style = useAnimatedStyle(() => ({
        transform: [{ scale: scale2.value }],
        opacity: opacity2.value,
    }));

    return (
        <View style={pulseStyles.container}>
            <Animated.View style={[pulseStyles.ring, pulseStyles.ring1, ring1Style]} />
            <Animated.View style={[pulseStyles.ring, pulseStyles.ring2, ring2Style]} />
            <View style={pulseStyles.core}>
                <View style={pulseStyles.coreInner}>
                    <Text style={pulseStyles.sosText}>SOS</Text>
                </View>
            </View>
        </View>
    );
};

const pulseStyles = StyleSheet.create({
    container: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
    ring: {
        position: 'absolute',
        width: 160, height: 160,
        borderRadius: 80,
        backgroundColor: C.red,
    },
    ring1: { opacity: 0.6 },
    ring2: { opacity: 0.3 },
    core: {
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: C.red,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: C.red, shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5, shadowRadius: 20, elevation: 14,
    },
    coreInner: { alignItems: 'center' },
    sosText: { fontSize: 32, fontWeight: '900', color: C.white, letterSpacing: 4 },
});

// ─── Timer ──────────────────────────────────────────────────────────
function formatTime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─── Main Screen ─────────────────────────────────────────────────────
type ParamList = { SOSScreen: { userId: string; userName: string } };
type Props = NativeStackScreenProps<ParamList, 'SOSScreen'>;

const SOSScreen: React.FC<Props> = ({ navigation, route }) => {
    const { userId, userName } = route.params;

    const [isActive, setIsActive] = useState(false);
    const [sosRecord, setSosRecord] = useState<SOSRecord | null>(null);
    const [contacts, setContacts] = useState<TrustedContact[]>([]);
    const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
    const [elapsedSec, setElapsedSec] = useState(0);
    const [notifying, setNotifying] = useState(false);
    const [synced, setSynced] = useState(false);
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [sosStatus, setSosStatus] = useState<'idle' | 'sent' | 'queued'>('idle');
    const [govtAction, setGovtAction] = useState<GovtAction | null>(null);
    const [batteryInfo, setBatteryInfo] = useState<{ percent: string; icon: string; color: string }>({ percent: '—', icon: '🔋', color: '#2A7A5A' });
    const [peerCount, setPeerCount] = useState(0);
    const knownPeers = useRef<Map<string, number>>(new Map());  // peer origin → last seen timestamp
    const prevConnected = useRef<boolean | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const peerCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Check connectivity via lightweight ping ──
    const checkConnectivity = useCallback(async () => {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            const res = await fetch('https://www.google.com/generate_204', {
                method: 'HEAD',
                cache: 'no-cache',
                signal: controller.signal,
            });
            clearTimeout(timer);
            const online = res.ok || res.status === 204;
            setIsConnected(online);

            // Auto-sync when coming back online
            if (online && prevConnected.current === false) {
                console.log('[SOS] Back online — syncing queued data...');
                sosService.flushSyncQueue().then(({ flushed }) => {
                    if (flushed > 0) console.log('[SOS] Synced', flushed, 'queued records ✅');
                }).catch(() => { });
                // Also sync chat messages
                import('../services/chatService').then(({ chatService: cs }) => {
                    cs.syncPendingMessages().then(n => {
                        if (n > 0) console.log('[Chat] Synced', n, 'pending messages ✅');
                    });
                }).catch(() => { });
            }
            prevConnected.current = online;
        } catch {
            setIsConnected(false);
            prevConnected.current = false;
        }
    }, []);

    // ── Load contacts + location + connectivity ──
    useEffect(() => {
        contactsService.getTrusted().then(setContacts);
        locationService.getCurrentLocation().then(loc => {
            if (loc) {
                setLocation({ latitude: loc.latitude, longitude: loc.longitude });
                locationService.getAddressFromCoordinates(loc.latitude, loc.longitude).then(addr => {
                    setLocation(prev => prev ? { ...prev, address: addr ?? undefined } : null);
                });
            }
        });
        // Check connectivity on mount (battery-aware interval)
        checkConnectivity();
        const pingInterval = setInterval(checkConnectivity, batteryService.profile.connectivityPing);

        // Init battery monitor
        batteryService.init().then(() => {
            setBatteryInfo(batteryService.getDisplayInfo());
        });
        const removeBatteryListener = batteryService.onModeChange((state: BatteryState) => {
            setBatteryInfo(batteryService.getDisplayInfo());
            console.log('[SOS] Power mode:', state.mode, '- adjusting intervals');
            // Notify user when battery hits critical
            if (state.mode === 'critical') {
                notificationService.notifyBatteryCritical(state.level);
            }
        });

        // Init notification + sound services
        notificationService.init();
        soundService.init();

        // Start location trail recording (battery-aware)
        locationTrailService.start();

        // Init mesh networking only after runtime permissions are granted
        permissionService.enableMesh({
            displayName: userName,
            showEnabledAlert: false,
            onPacket: (pkt) => {
                console.log('[SOSScreen] Mesh packet received:', pkt.type, 'hops:', pkt.hops);
                // Track unique peers by origin with timestamp
                if (pkt.type === 'ping' && pkt.origin !== userId) {
                    knownPeers.current.set(pkt.origin, Date.now());
                    // Clean expired peers (2 min TTL)
                    const now = Date.now();
                    for (const [id, ts] of knownPeers.current) {
                        if (now - ts > 120_000) knownPeers.current.delete(id);
                    }
                    setPeerCount(knownPeers.current.size);
                }
                // Alert user when a real SOS comes in from a nearby device
                if (pkt.type === 'sos' && pkt.origin !== userId) {
                    soundService.playSosAlert();
                    try {
                        const sosData = typeof pkt.payload === 'string' ? JSON.parse(pkt.payload) : pkt.payload;
                        notificationService.notifyNearbySOS({
                            userName: sosData?.userName ?? 'Someone',
                            address: sosData?.gps?.address,
                            hops: pkt.hops,
                        });
                    } catch {
                        notificationService.notifyNearbySOS({ userName: 'Someone', hops: pkt.hops });
                    }
                }
            },
        }).then(ready => {
            if (ready) {
                console.log('[SOSScreen] Mesh ready ✅');
            } else {
                console.warn('[SOSScreen] Mesh unavailable — permission denied or radios disabled');
            }
        });

        // Also update peer count from BLE service's discovered devices
        peerCleanupRef.current = setInterval(() => {
            const blePeers = bleMeshService.getPeerCount();
            const meshPeers = knownPeers.current.size;
            setPeerCount(Math.max(blePeers, meshPeers));
        }, 15_000);

        return () => {
            clearInterval(pingInterval);
            bleMeshService.stopScanning();
            locationTrailService.stop();
            batteryService.destroy();
            removeBatteryListener();
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            if (peerCleanupRef.current) clearInterval(peerCleanupRef.current);
            soundService.destroy();
        };
    }, [checkConnectivity]);

    // ── Timer ──
    useEffect(() => {
        if (isActive) {
            timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isActive]);

    // ── Poll for Govt Action (Online: Firebase, Offline: AsyncStorage cache via BLE mesh) ──
    useEffect(() => {
        if (!isActive || !sosRecord?.id) return;
        console.log('[SOS] Starting govtAction poll for:', sosRecord.id);
        const pollGovtAction = async () => {
            try {
                const action = await sosService.getGovtAction(sosRecord.id);
                if (action && !govtAction) {
                    // First time receiving — vibrate, play sound AND show push notification!
                    Vibration.vibrate([0, 200, 100, 200, 100, 400]);
                    soundService.playGovtActionAlert();
                    notificationService.notifyGovtAction({
                        status: action.status,
                        message: action.message,
                        officerName: action.officerName,
                        estimatedArrival: action.estimatedArrival,
                        campName: action.campName,
                    });
                    console.log('[SOS] 🚒 GOVT ACTION RECEIVED!', action.status);
                }
                if (action) setGovtAction(action);
            } catch (e) {
                console.log('[SOS] Poll error:', e);
            }
        };
        pollGovtAction();
        const pollMs = batteryService.profile?.firebasePoll || 15_000;
        console.log('[SOS] Poll interval:', Math.round(pollMs / 1000), 's');
        const interval = setInterval(pollGovtAction, pollMs);
        return () => clearInterval(interval);
    }, [isActive, sosRecord?.id]);

    // ── Heartbeat broadcast (lets nearby users know we exist) ──
    useEffect(() => {
        if (!isActive) return;
        const sendHeartbeat = () => {
            if (bleMeshService.ready) {
                const hbPkt = bleMeshService.createSOSPacket(userId, {
                    type: 'heartbeat',
                    userId,
                    userName,
                    battery: batteryService.level,
                    timestamp: Date.now(),
                });
                hbPkt.type = 'ping';
                bleMeshService.broadcast(hbPkt).catch(() => { });
            }
        };
        sendHeartbeat();
        heartbeatRef.current = setInterval(sendHeartbeat, batteryService.profile.heartbeat);
        return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
    }, [isActive, userId, userName]);

    // ── Activate SOS ──
    const activateSOS = useCallback(async () => {
        setNotifying(true);
        Vibration.vibrate([0, 300, 100, 300, 100, 300]);

        const gps = {
            latitude: location?.latitude ?? 0,
            longitude: location?.longitude ?? 0,
            address: location?.address,
        };

        // 1. Save locally offline-first
        const record = await sosService.activateSOS(
            userId, userName, gps,
            contacts.map(c => c.id)
        );
        setSosRecord(record);
        setIsActive(true);

        // 2. Collect all phone numbers with a signal
        const phones = contacts.map(c => c.phone).filter(Boolean) as string[];
        const mapsLink = `https://maps.google.com/?q=${gps.latitude},${gps.longitude}`;
        const message =
            `🚨 EMERGENCY ALERT 🚨\n` +
            `${userName} needs help!\n` +
            `📍 ${gps.address ?? mapsLink}\n` +
            `🔗 ${mapsLink}\n\n` +
            `Sent via SafeConnect`;

        if (phones.length > 0) {
            try {
                const smsCheckPromise = SMS.isAvailableAsync();
                const timeoutPromise = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 5000));
                const isAvailable = await Promise.race([smsCheckPromise, timeoutPromise]);
                if (isAvailable) {
                    // ONE compose sheet — all contacts pre-loaded — user taps Send ONCE
                    await SMS.sendSMSAsync(phones, message);
                    setSosStatus(isConnected ? 'sent' : 'queued');
                } else {
                    // Fallback: open default SMS app for first contact only
                    try {
                        await Linking.openURL(
                            `sms:${phones[0]}?body=${encodeURIComponent(message)}`
                        );
                        setSosStatus(isConnected ? 'sent' : 'queued');
                    } catch { setSosStatus('queued'); }
                }
            } catch (e) {
                console.warn('[SOS] SMS check failed:', e);
                setSosStatus('queued');
            }
        } else {
            setSosStatus('queued'); // No contacts yet
        }

        // 3. Try sync to Firebase (gateway pattern)
        const { flushed } = await sosService.flushSyncQueue();
        setSynced(flushed > 0);

        // 4. Upload GPS trail alongside SOS
        try {
            await locationTrailService.uploadTrail(record.id, 60);
            console.log('[Trail] Location trail uploaded ✅');
        } catch { console.log('[Trail] Upload skipped'); }

        // 5. Mesh Broadcast — relay SOS to nearby SafeConnect devices
        //    Include phone numbers + message so gateway can forward SMS
        //    to contacts who DON'T have SafeConnect (e.g. User B with just signal)
        try {
            const bleReady = bleMeshService.ready;
            if (bleReady) {
                const blePkt = bleMeshService.createSOSPacket(userId, {
                    ...record,
                    emergencyPhones: phones,       // contacts' phone numbers
                    emergencyMessage: message,     // pre-built SMS text
                });
                await bleMeshService.broadcast(blePkt);
                console.log('[Mesh] SOS broadcast sent ✅ (with', phones.length, 'phone numbers for relay)');

                // If battery critical, send a special alert
                if (batteryService.mode === 'critical') {
                    const critPkt = bleMeshService.createSOSPacket(userId, {
                        ...record,
                        batteryCritical: true,
                        batteryLevel: Math.round(batteryService.level * 100),
                    });
                    await bleMeshService.broadcast(critPkt);
                    console.log('[Mesh] Battery critical alert sent ⚠️');
                }
            } else {
                console.log('[Mesh] Not available yet — SOS queued for mesh delivery');
            }
        } catch (bleErr) {
            console.log('[Mesh] Broadcast skipped:', bleErr);
        }

        setNotifying(false);
    }, [location, contacts, userId, userName, isConnected]);

    // ── Deactivate SOS ──
    const deactivateSOS = async () => {
        Alert.alert(
            '✅ Confirm Safe',
            'Are you safe? This will deactivate the emergency alert.',
            [
                { text: 'Keep Active', style: 'cancel' },
                {
                    text: "I'm Safe",
                    style: 'default',
                    onPress: async () => {
                        await sosService.deactivateSOS();
                        setIsActive(false);
                        Vibration.vibrate(100);
                        navigation.goBack();
                    },
                },
            ]
        );
    };

    const mapsUrl = location
        ? `https://maps.google.com/?q=${location.latitude},${location.longitude}`
        : null;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <BackIcon />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Emergency Mode</Text>
                    <Text style={styles.headerSub}>
                        {isActive ? `Active · ${formatTime(elapsedSec)}` : 'Not activated'}
                    </Text>
                </View>
                <View style={[
                    styles.syncBadge,
                    isConnected === true && styles.syncBadgeOnline,
                    isConnected === false && styles.syncBadgeOffline,
                ]}>
                    <Text style={styles.syncBadgeText}>
                        {isConnected === null ? '⏳ Checking' : isConnected ? '📶 Signal' : '📵 No Signal'}
                    </Text>
                </View>
                <View style={[styles.syncBadge, { borderColor: batteryInfo.color, backgroundColor: batteryInfo.color + '18' }]}>
                    <Text style={[styles.syncBadgeText, { color: batteryInfo.color }]}>
                        {batteryInfo.icon} {batteryInfo.percent}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.meshBtn}
                    onPress={() => (navigation as any).navigate('MeshStatus', { userId, userName })}
                    activeOpacity={0.75}
                >
                    <Text style={styles.meshBtnText}>📡</Text>
                </TouchableOpacity>
            </View>

            {/* ── Status Bar: Peer count + Power mode ── */}
            {isActive && (
                <Animated.View entering={FadeInDown.duration(300)} style={styles.statusBar}>
                    <View style={styles.statusItem}>
                        <Text style={styles.statusIcon}>📡</Text>
                        <Text style={styles.statusLabel}>{peerCount} nearby</Text>
                    </View>
                    <View style={styles.statusSep} />
                    <View style={styles.statusItem}>
                        <Text style={styles.statusIcon}>{batteryInfo.icon}</Text>
                        <Text style={styles.statusLabel}>{batteryInfo.percent}</Text>
                    </View>
                    <View style={styles.statusSep} />
                    <View style={styles.statusItem}>
                        <Text style={styles.statusIcon}>{batteryService.mode === 'critical' ? '🪫' : batteryService.mode === 'low' ? '⚡' : '⚡'}</Text>
                        <Text style={[styles.statusLabel, batteryService.mode === 'critical' && { color: C.red }]}>
                            {batteryService.mode === 'critical' ? 'POWER SAVE' : batteryService.mode === 'low' ? 'Low Power' : 'Normal'}
                        </Text>
                    </View>
                    <View style={styles.statusSep} />
                    <View style={styles.statusItem}>
                        <Text style={styles.statusIcon}>📍</Text>
                        <Text style={styles.statusLabel}>Trail ON</Text>
                    </View>
                </Animated.View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                {/* ── GOVT RESPONSE NOTIFICATION ── */}
                {isActive && govtAction && (
                    <Animated.View entering={FadeInDown.duration(500)} style={styles.govtBanner}>
                        <View style={styles.govtBannerIcon}>
                            <Text style={{ fontSize: 28 }}>🚒</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.govtBannerTitle}>Help Is On The Way!</Text>
                            <Text style={styles.govtBannerMsg}>{govtAction.message}</Text>
                            {govtAction.estimatedArrival && (
                                <Text style={styles.govtBannerSub}>⏱ ETA: {govtAction.estimatedArrival}</Text>
                            )}
                            {govtAction.campName && (
                                <Text style={styles.govtBannerSub}>📍 Camp: {govtAction.campName}</Text>
                            )}
                            {govtAction.officerName && (
                                <Text style={styles.govtBannerSub}>👮 Officer: {govtAction.officerName}</Text>
                            )}
                            <Text style={styles.govtBannerTime}>
                                {!isConnected ? '📵 Received via BLE mesh network' : '📶 Received from Govt EOC'}
                            </Text>
                        </View>
                    </Animated.View>
                )}

                {/* ── No Signal Warning Banner ── */}
                {isConnected === false && !isActive && (
                    <Animated.View entering={FadeInDown.duration(400)} style={styles.noSignalBanner}>
                        <Text style={styles.noSignalTitle}>📵 No Signal Detected</Text>
                        <Text style={styles.noSignalBody}>
                            You can still activate SOS. Here's what will happen:{`\n`}
                            {'✅'} Alert saved on this device{`\n`}
                            {'⏳'} SMS queued — sends the moment signal returns{`\n`}
                            {'📡'} Mesh will relay to nearby SafeConnect devices
                        </Text>
                    </Animated.View>
                )}

                {/* ── Post-Activation Status Card ── */}
                {isActive && sosStatus === 'queued' && (
                    <Animated.View entering={FadeInDown.duration(400)} style={styles.queuedBanner}>
                        <Text style={styles.queuedTitle}>⏳ SMS Queued — No Signal</Text>
                        <Text style={styles.queuedBody}>
                            {'✅'} SOS saved locally on device{`\n`}
                            {'⏳'} SMS will auto-send when signal returns{`\n`}
                            {'☁️'} Will sync to coordination centre via gateway{`\n`}
                            {'📡'} Mesh broadcast active — relaying to nearby devices
                        </Text>
                    </Animated.View>
                )}

                {/* ── Pulse SOS Button ── */}
                <Animated.View entering={FadeInDown.duration(500)} style={styles.pulseWrap}>
                    <PulseRing isActive={isActive} />
                    {!isActive ? (
                        <TouchableOpacity
                            style={styles.activateBtn}
                            onPress={activateSOS}
                            activeOpacity={0.85}
                            disabled={notifying}
                        >
                            <AlertIcon />
                            <Text style={styles.activateBtnText}>
                                {notifying ? 'Sending alerts...' : 'ACTIVATE SOS'}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.activeLabel}>🚨 Emergency Alert Active</Text>
                    )}
                </Animated.View>

                {/* ── Location card ── */}
                <Animated.View entering={FadeInUp.duration(400).delay(100)}>
                    <TouchableOpacity
                        style={styles.locationCard}
                        activeOpacity={0.85}
                        onPress={() => mapsUrl && Linking.openURL(mapsUrl)}
                    >
                        <LocationIcon />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.locationLabel}>Your Location</Text>
                            <Text style={styles.locationAddress} numberOfLines={2}>
                                {location?.address ?? (location
                                    ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                                    : 'Fetching GPS...')}
                            </Text>
                        </View>
                        <Text style={styles.mapsLink}>Open ↗</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* ── Contacts Notified ── */}
                <Animated.View entering={FadeInUp.duration(400).delay(160)} style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {isActive ? '✅ Contacts Notified' : '👥 Will Notify'}
                    </Text>
                    {contacts.length === 0 ? (
                        <TouchableOpacity
                            style={styles.noContactsCard}
                            onPress={() => navigation.navigate('ContactsManager' as any)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.noContactsText}>
                                ⚠️ No trusted contacts added yet.{'\n'}
                                <Text style={{ color: C.red, fontWeight: '700' }}>Tap to add contacts →</Text>
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        contacts.map((c, i) => (
                            <Animated.View key={c.id} entering={FadeInUp.duration(300).delay(i * 60)} style={styles.contactRow}>
                                <View style={[styles.contactAvatar, { backgroundColor: c.avatarColor + '22' }]}>
                                    <Text style={[styles.contactInitials, { color: c.avatarColor }]}>
                                        {contactsService.getInitials(c.name)}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.contactName}>{c.name}</Text>
                                    <Text style={styles.contactRel}>{c.relationship} · {c.phone}</Text>
                                </View>
                                {isActive && (
                                    <View style={styles.notifiedBadge}>
                                        <CheckIcon />
                                        <Text style={styles.notifiedText}>Alerted</Text>
                                    </View>
                                )}
                            </Animated.View>
                        ))
                    )}
                </Animated.View>

                {/* ── Action Buttons ── */}
                <Animated.View entering={FadeInUp.duration(400).delay(250)} style={styles.actionsRow}>
                    {/* I Need Help */}
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: C.redLight, borderColor: C.red }]}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('NeedsReport' as any, { userId, userName, location })}
                    >
                        <Text style={styles.actionBtnEmoji}>📢</Text>
                        <Text style={[styles.actionBtnLabel, { color: C.red }]}>I Need Help</Text>
                        <Text style={styles.actionBtnSub}>Report needs to{'\n'}relief coordination</Text>
                    </TouchableOpacity>

                    {/* I Can Help */}
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: C.greenLight, borderColor: C.green }]}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('ResourceOffer' as any, { userId, userName, location })}
                    >
                        <Text style={styles.actionBtnEmoji}>🤝</Text>
                        <Text style={[styles.actionBtnLabel, { color: C.green }]}>I Can Help</Text>
                        <Text style={styles.actionBtnSub}>Offer food, water{'\n'}or shelter</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Relief Camps button */}
                <Animated.View entering={FadeInUp.duration(400).delay(300)}>
                    <TouchableOpacity
                        style={styles.reliefBtn}
                        activeOpacity={0.82}
                        onPress={() => navigation.navigate('ReliefMap' as any, { location })}
                    >
                        <Text style={styles.reliefBtnEmoji}>🏕️</Text>
                        <View>
                            <Text style={styles.reliefBtnLabel}>Find Nearest Relief Camp</Text>
                            <Text style={styles.reliefBtnSub}>Food · Water · Medical · Shelter</Text>
                        </View>
                        <Text style={styles.reliefArrow}>→</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* ── I'm Safe Button ── */}
                {isActive && (
                    <Animated.View entering={FadeInUp.duration(400)} style={{ marginTop: 24 }}>
                        <TouchableOpacity style={styles.safeBtn} onPress={deactivateSOS} activeOpacity={0.85}>
                            <Text style={styles.safeBtnText}>✅ I'm Safe — End Emergency</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Offline note */}
                <View style={styles.offlineNote}>
                    <Text style={styles.offlineNoteText}>
                        🔒 All data saved offline first. Automatically syncs to government coordination centre when internet is available via any nearby device.
                    </Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: C.bg },

    header: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 11,
        backgroundColor: 'rgba(44,26,14,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '800', color: C.brown, letterSpacing: -0.3 },
    headerSub: { fontSize: 11, fontWeight: '500', color: C.muted, marginTop: 1 },
    syncBadge: {
        marginLeft: 'auto', backgroundColor: 'rgba(44,26,14,0.08)',
        borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    },
    syncBadgeOnline: { backgroundColor: 'rgba(42,122,90,0.12)' },
    syncBadgeOffline: { backgroundColor: 'rgba(211,47,47,0.12)' },
    syncBadgeText: { fontSize: 11, fontWeight: '600', color: C.muted },

    // No signal banners
    noSignalBanner: {
        backgroundColor: 'rgba(230,81,0,0.10)', borderWidth: 1.5,
        borderColor: '#E65100', borderRadius: 14,
        padding: 14, marginBottom: 16,
    },
    noSignalTitle: { fontSize: 14, fontWeight: '800', color: '#E65100', marginBottom: 6 },
    noSignalBody: { fontSize: 12, color: '#5D2A00', lineHeight: 20, fontWeight: '500' },

    queuedBanner: {
        backgroundColor: 'rgba(21,101,192,0.10)', borderWidth: 1.5,
        borderColor: C.blue, borderRadius: 14,
        padding: 14, marginBottom: 16,
    },
    queuedTitle: { fontSize: 14, fontWeight: '800', color: C.blue, marginBottom: 6 },
    queuedBody: { fontSize: 12, color: C.blue, lineHeight: 20, fontWeight: '500', opacity: 0.85 },

    scroll: { paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 40 },

    // Pulse
    pulseWrap: { alignItems: 'center', marginBottom: 24, gap: 16 },
    activateBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: C.red, borderRadius: 50,
        paddingVertical: 14, paddingHorizontal: 28,
        shadowColor: C.red, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35, shadowRadius: 12, elevation: 7,
    },
    activateBtnText: { fontSize: 16, fontWeight: '800', color: C.white, letterSpacing: 0.5 },
    activeLabel: { fontSize: 15, fontWeight: '700', color: C.red, letterSpacing: -0.2 },

    // Location
    locationCard: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: C.red, borderRadius: 14, padding: 14, marginBottom: 16,
    },
    locationLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
    locationAddress: { fontSize: 13, fontWeight: '600', color: C.white, lineHeight: 18 },
    mapsLink: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },

    // Section
    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 0.8, marginBottom: 10 },
    noContactsCard: {
        backgroundColor: 'rgba(211,47,47,0.08)', borderWidth: 1.5, borderColor: C.red,
        borderRadius: 14, padding: 16,
    },
    noContactsText: { fontSize: 13, color: C.brown, lineHeight: 20, textAlign: 'center' },
    contactRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
        borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
    },
    contactAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    contactInitials: { fontSize: 14, fontWeight: '800' },
    contactName: { fontSize: 14, fontWeight: '700', color: C.brown },
    contactRel: { fontSize: 11, fontWeight: '500', color: C.muted, marginTop: 1 },
    notifiedBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: C.greenLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    notifiedText: { fontSize: 11, fontWeight: '700', color: C.green },

    // Action buttons
    actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    actionBtn: {
        flex: 1, borderWidth: 1.5, borderRadius: 16, padding: 14,
        alignItems: 'center', gap: 6,
    },
    actionBtnEmoji: { fontSize: 28 },
    actionBtnLabel: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
    actionBtnSub: { fontSize: 10, fontWeight: '500', color: C.muted, textAlign: 'center', lineHeight: 14 },

    // Relief
    reliefBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.blueLight, borderWidth: 1.5, borderColor: C.blue,
        borderRadius: 16, padding: 14, marginBottom: 8,
    },
    reliefBtnEmoji: { fontSize: 28 },
    reliefBtnLabel: { fontSize: 14, fontWeight: '700', color: C.blue },
    reliefBtnSub: { fontSize: 11, fontWeight: '500', color: C.muted, marginTop: 2 },
    reliefArrow: { marginLeft: 'auto', fontSize: 18, color: C.blue },

    // I'm safe
    safeBtn: {
        backgroundColor: C.green, borderRadius: 50,
        paddingVertical: 16, alignItems: 'center',
        shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    },
    safeBtnText: { fontSize: 16, fontWeight: '800', color: C.white },

    // Offline note
    offlineNote: {
        marginTop: 24, backgroundColor: 'rgba(44,26,14,0.05)',
        borderRadius: 12, padding: 14,
    },
    offlineNoteText: { fontSize: 11, color: C.muted, lineHeight: 17, textAlign: 'center' },

    // Mesh Monitor button (header)
    meshBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: 'rgba(21,101,192,0.12)',
        alignItems: 'center', justifyContent: 'center',
        marginLeft: 6,
    },
    meshBtnText: { fontSize: 18 },

    // Govt response notification banner
    govtBanner: {
        flexDirection: 'row', gap: 12,
        backgroundColor: 'rgba(42,122,90,0.12)',
        borderWidth: 1.5, borderColor: 'rgba(42,122,90,0.4)',
        borderRadius: 16, padding: 14, marginBottom: 14,
    },
    govtBannerIcon: {
        width: 50, height: 50, borderRadius: 14,
        backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
        shadowColor: C.green, shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, flexShrink: 0,
    },
    govtBannerTitle: { fontSize: 15, fontWeight: '900', color: C.green, marginBottom: 3 },
    govtBannerMsg: { fontSize: 13, color: C.brown, fontWeight: '600', lineHeight: 18, marginBottom: 6 },
    govtBannerSub: { fontSize: 11, color: C.green, fontWeight: '600', marginTop: 3 },
    govtBannerTime: { fontSize: 10, color: C.muted, marginTop: 6, fontWeight: '500' },

    // Status bar (battery, peers, power mode, trail)
    statusBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(44,26,14,0.04)', paddingVertical: 6, paddingHorizontal: 12,
        gap: 6,
    },
    statusItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    statusIcon: { fontSize: 11 },
    statusLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 0.3 },
    statusSep: { width: 1, height: 12, backgroundColor: 'rgba(44,26,14,0.12)', marginHorizontal: 4 },
});

export default SOSScreen;
