/**
 * MeshStatusScreen.tsx — Mesh Network Status (User-Friendly)
 */

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { bleMeshService, MeshPacket, MeshUIEvent } from '../services/ble/BLEMeshService';
import { permissionService } from '../services/permissionService';

// ─── Colors ─────────────────────────────────────────────────────────
const C = {
    bg: '#EBF4F7', brown: '#2C1A0E', muted: '#8C7060', white: '#FFFFFF',
    green: '#2A7A5A', greenLight: 'rgba(42,122,90,0.12)',
    red: '#D32F2F', redLight: 'rgba(211,47,47,0.10)',
    blue: '#1565C0', blueLight: 'rgba(21,101,192,0.10)',
    orange: '#E65100', orangeLight: 'rgba(230,81,0,0.10)',
    border: 'rgba(44,26,14,0.08)', card: 'rgba(255,255,255,0.95)',
};

const BackIcon = () => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M12 19l-7-7 7-7" stroke={C.brown} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

type ParamList = { MeshStatus: { userId: string; userName: string } };
type Props = NativeStackScreenProps<ParamList, 'MeshStatus'>;

interface ActivityEntry {
    id: string;
    time: string;
    icon: string;
    message: string;
    color: string;
}

/** Translate a mesh packet type to a human-readable activity message */
function packetToActivity(pkt: MeshPacket): Pick<ActivityEntry, 'icon' | 'message' | 'color'> {
    switch (pkt.type) {
        case 'sos':
            return { icon: '🆘', message: 'Emergency alert received through the mesh', color: C.red };
        case 'chat':
            return { icon: '💬', message: 'A message was relayed through the mesh', color: C.blue };
        case 'location':
            return { icon: '📍', message: 'Someone shared their location through the mesh', color: C.orange };
        default:
            return { icon: '📡', message: 'Signal received from a nearby device', color: C.green };
    }
}

const MeshStatusScreen: React.FC<Props> = ({ navigation, route }) => {
    const userId  = route.params?.userId   ?? 'anonymous';
    const userName = route.params?.userName ?? 'User';

    // Initialise from live service state so navigating back doesn't reset the button
    const [bleReady, setBleReady] = useState<boolean | null>(() => permissionService.isBLEReady());
    const [scanning, setScanning]  = useState(() => permissionService.isBLEReady());
    const [peerCount, setPeerCount] = useState(0);
    const [activity, setActivity]  = useState<ActivityEntry[]>([]);

    // Connection popup — shown like a Bluetooth pairing notification
    const [connPopup, setConnPopup] = useState<{
        visible: boolean; icon: string; title: string; subtitle: string; color: string;
    }>({ visible: false, icon: '', title: '', subtitle: '', color: C.blue });

    const peerPollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
    const popupTimerRef = useRef<ReturnType<typeof setTimeout>  | null>(null);

    const showConnPopup = useCallback((icon: string, title: string, subtitle: string, color: string) => {
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        setConnPopup({ visible: true, icon, title, subtitle, color });
        popupTimerRef.current = setTimeout(() =>
            setConnPopup(prev => ({ ...prev, visible: false })), 3500);
    }, []);

    const addActivity = (icon: string, message: string, color: string) => {
        const entry: ActivityEntry = {
            id: `${Date.now()}_${Math.random()}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            icon, message, color,
        };
        setActivity(prev => [entry, ...prev].slice(0, 10));
    };

    const handlePacket = useCallback((pkt: MeshPacket) => {
        const { icon, message, color } = packetToActivity(pkt);
        addActivity(icon, message, color);
        setPeerCount(bleMeshService.getPeerCount());
    }, []);

    // ── Subscribe to BLE connection events (Bluetooth-style popups) ──
    useEffect(() => {
        const handleUI = (e: MeshUIEvent) => {
            switch (e.event) {
                case 'found':
                    showConnPopup('📱', `Found: ${e.peerName}`, 'Requesting connection…', C.blue);
                    addActivity('🔍', `Found nearby device: ${e.peerName}`, C.blue);
                    break;
                case 'connecting':
                    showConnPopup('🔄', `Connecting to ${e.peerName}…`, 'Please wait', C.blue);
                    break;
                case 'invitation':
                    showConnPopup('📲', `${e.peerName} is connecting`, 'Accepting — joining the mesh…', C.blue);
                    addActivity('📲', `Incoming connection from ${e.peerName}`, C.blue);
                    break;
                case 'connected':
                    showConnPopup('✅', `Connected to ${e.peerName}!`, 'You can now share emergency data offline', C.green);
                    addActivity('🔗', `Connected to ${e.peerName}`, C.green);
                    setPeerCount(bleMeshService.getPeerCount());
                    break;
                case 'disconnected':
                    showConnPopup('📡', `${e.peerName} left the mesh`, 'Device went out of range', C.orange);
                    addActivity('🔌', `${e.peerName} went out of range`, C.muted);
                    setPeerCount(bleMeshService.getPeerCount());
                    break;
            }
        };
        bleMeshService.addUIListener(handleUI);
        return () => {
            bleMeshService.removeUIListener(handleUI);
            if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        };
    }, [showConnPopup]);

    // ── Poll peer count every 3 s while mounted ───────────────────────
    useEffect(() => {
        peerPollRef.current = setInterval(() => {
            setPeerCount(bleMeshService.getPeerCount());
        }, 3000);
        return () => {
            if (peerPollRef.current) clearInterval(peerPollRef.current);
        };
    }, []);

    // ── Reflect live mesh state ──────────────────────────────────────
    useEffect(() => {
        setBleReady(permissionService.isBLEReady());
        setScanning(permissionService.isBLEReady());
        if (permissionService.isBLEReady()) {
            addActivity('✅', 'Mesh network is active on your phone', C.green);
        }
        return () => {
            bleMeshService.stopScanning();
        };
    }, []);

    // ── Turn mesh on ─────────────────────────────────────────────────
    const startMesh = async () => {
        const ready = await permissionService.enableMesh({
            displayName: userName,
            onPacket: handlePacket,
            showEnabledAlert: false,
        });

        setBleReady(ready);
        setScanning(ready);

        if (ready) {
            addActivity('📡', 'Listening for nearby SafeConnect users…', C.blue);
        } else {
            addActivity('⚠️', 'Could not start mesh — check Bluetooth, Wi-Fi and Location', C.red);
        }
    };

    // ── Turn mesh off ────────────────────────────────────────────────
    const stopMesh = () => {
        permissionService.disableMesh();
        setBleReady(false);
        setScanning(false);
        addActivity('🔇', 'Mesh turned off', C.muted);
    };

    // ── Send test ping ───────────────────────────────────────────────
    const sendTestPing = async () => {
        if (!bleReady) {
            Alert.alert('Mesh Not Ready', 'Turn on the mesh first, then try again.');
            return;
        }
        const pkt = bleMeshService.createSOSPacket(userId, {
            userId, userName,
            gps: { latitude: 19.076, longitude: 72.877, address: 'Test location' },
            activatedAt: Date.now(),
            isActive: true,
            contactsNotified: [],
            synced: false,
            isTestPacket: true,
        });
        await bleMeshService.broadcast(pkt);
        addActivity('🧪', 'Test ping sent — nearby phones should receive it', C.blue);
    };

    // ── Derived display values ────────────────────────────────────────
    const statusColor =
        bleReady === null ? C.orange :
        scanning ? C.green :
        bleReady ? C.blue : C.orange;

    const statusEmoji =
        bleReady === null ? '⏳' :
        scanning ? '📡' :
        bleReady ? '✅' : '⏸️';

    const statusLabel =
        bleReady === null ? 'Starting up…' :
        scanning ? 'Active — listening for people' :
        bleReady ? 'Ready (not yet listening)' : 'Mesh is off';

    const statusDesc =
        bleReady === null ? 'Please wait while we set up your mesh.' :
        scanning ? 'Your phone is sharing safety signals with nearby SafeConnect users.' :
        bleReady ? 'Tap "Turn On Mesh" to reconnect with people nearby.' :
        'Tap "Turn On Mesh". The app will request permissions and start nearby discovery.';

    const peerLabel =
        peerCount === 0 ? 'No one nearby yet' :
        peerCount === 1 ? '1 person nearby on SafeConnect' :
        `${peerCount} people nearby on SafeConnect`;

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

            {/* ── Header ── */}
            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <BackIcon />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={s.headerTitle}>Mesh Network</Text>
                    <Text style={s.headerSub}>Works without internet</Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

                {/* ── Hero status card ── */}
                <Animated.View entering={FadeInDown.duration(400)} style={[s.heroCard, { borderColor: statusColor + '55' }]}>
                    <Text style={s.heroEmoji}>{statusEmoji}</Text>
                    <Text style={[s.heroStatus, { color: statusColor }]}>{statusLabel}</Text>
                    <Text style={s.heroDesc}>{statusDesc}</Text>

                    {/* Peer count pill */}
                    <View style={[s.peerPill, { backgroundColor: statusColor + '18', borderColor: statusColor + '44' }]}>
                        <Text style={[s.peerText, { color: statusColor }]}>👥  {peerLabel}</Text>
                    </View>
                </Animated.View>

                {/* ── Main button ── */}
                <Animated.View entering={FadeInUp.duration(400).delay(60)} style={s.btnRow}>
                    {!scanning ? (
                        <TouchableOpacity
                            style={[s.mainBtn, { backgroundColor: bleReady ? C.green : C.muted }]}
                            onPress={startMesh} activeOpacity={0.85}
                            disabled={bleReady !== true}>
                            <Text style={s.mainBtnText}>📡  Turn On Mesh</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[s.mainBtn, { backgroundColor: C.red }]}
                            onPress={stopMesh} activeOpacity={0.85}>
                            <Text style={s.mainBtnText}>🔇  Turn Off Mesh</Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>

                {/* ── What is mesh? ── */}
                <Animated.View entering={FadeInUp.duration(400).delay(100)} style={s.explainerCard}>
                    <Text style={s.explainerTitle}>How does this work?</Text>
                    {[
                        { icon: '📵', text: 'No internet needed — works when mobile networks are down' },
                        { icon: '🔗', text: 'Your phone connects directly to other nearby SafeConnect phones' },
                        { icon: '🆘', text: 'Emergency alerts travel from phone to phone to reach help farther away' },
                        { icon: '🔒', text: 'Only SafeConnect users can join — your data stays safe' },
                    ].map(item => (
                        <View key={item.icon} style={s.explainerRow}>
                            <Text style={s.explainerIcon}>{item.icon}</Text>
                            <Text style={s.explainerText}>{item.text}</Text>
                        </View>
                    ))}
                </Animated.View>

                {/* ── Tips for better connection ── */}
                <Animated.View entering={FadeInUp.duration(400).delay(140)} style={s.tipsCard}>
                    <Text style={s.tipsTitle}>💡  Tips for the best connection</Text>
                    <Text style={s.tipItem}>• Keep Bluetooth, Wi-Fi and Location ON</Text>
                    <Text style={s.tipItem}>• Stay within ~60 m of another SafeConnect user</Text>
                    <Text style={s.tipItem}>• The more people who turn on mesh, the farther signals travel</Text>
                    <Text style={s.tipItem}>• Works even in Airplane Mode (as long as Bluetooth is on)</Text>
                </Animated.View>

                {/* ── Recent activity ── */}
                <Animated.View entering={FadeInUp.duration(400).delay(180)} style={s.activitySection}>
                    <Text style={s.sectionTitle}>Recent activity</Text>
                    {activity.length === 0 ? (
                        <View style={s.emptyActivity}>
                            <Text style={s.emptyText}>No activity yet.{'\n'}Turn on mesh to start connecting.</Text>
                        </View>
                    ) : activity.map(item => (
                        <View key={item.id} style={s.activityRow}>
                            <Text style={s.activityIcon}>{item.icon}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.activityMsg, { color: item.color }]}>{item.message}</Text>
                                <Text style={s.activityTime}>{item.time}</Text>
                            </View>
                        </View>
                    ))}
                </Animated.View>

                {/* ── Test ping button ── */}
                {bleReady === true && (
                    <Animated.View entering={FadeInUp.duration(400).delay(220)}>
                        <TouchableOpacity style={s.testBtn} onPress={sendTestPing} activeOpacity={0.8}>
                            <Text style={s.testBtnText}>🧪  Send a Test Ping</Text>
                            <Text style={s.testBtnSub}>Checks if nearby phones can receive your signal</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

            </ScrollView>

            {/* ── Bluetooth-style connection popup ─────────────────────────── */}
            {connPopup.visible && (
                <Animated.View entering={FadeInDown.duration(280)} style={[s.connPopup, { borderColor: connPopup.color }]}>
                    <View style={[s.connPopupDot, { backgroundColor: connPopup.color }]} />
                    <Text style={s.connPopupIcon}>{connPopup.icon}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[s.connPopupTitle, { color: connPopup.color }]}>{connPopup.title}</Text>
                        <Text style={s.connPopupSub}>{connPopup.subtitle}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setConnPopup(p => ({ ...p, visible: false }))} style={s.connPopupClose}>
                        <Text style={{ fontSize: 16, color: C.muted }}>✕</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

        </SafeAreaView>
    );
};

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 16, paddingBottom: 48 },

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
    headerTitle: { fontSize: 17, fontWeight: '800', color: C.brown },
    headerSub: { fontSize: 11, color: C.muted, fontWeight: '500', marginTop: 1 },

    /* Hero card */
    heroCard: {
        backgroundColor: C.card, borderWidth: 1.5,
        borderRadius: 20, padding: 24,
        alignItems: 'center', marginBottom: 14,
    },
    heroEmoji: { fontSize: 56, marginBottom: 10 },
    heroStatus: { fontSize: 20, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
    heroDesc: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 16 },
    peerPill: {
        borderWidth: 1.5, borderRadius: 30,
        paddingHorizontal: 18, paddingVertical: 8,
    },
    peerText: { fontSize: 14, fontWeight: '700' },

    /* Main button */
    btnRow: { marginBottom: 14 },
    mainBtn: {
        borderRadius: 16, paddingVertical: 16,
        alignItems: 'center', justifyContent: 'center',
        elevation: 2,
    },
    mainBtnText: { fontSize: 16, fontWeight: '800', color: C.white },

    /* Explainer */
    explainerCard: {
        backgroundColor: C.blueLight, borderWidth: 1.5,
        borderColor: C.blue + '33', borderRadius: 16,
        padding: 16, marginBottom: 14,
    },
    explainerTitle: { fontSize: 15, fontWeight: '800', color: C.blue, marginBottom: 12 },
    explainerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
    explainerIcon: { fontSize: 20, lineHeight: 24 },
    explainerText: { fontSize: 13, color: C.brown, lineHeight: 20, flex: 1 },

    /* Tips */
    tipsCard: {
        backgroundColor: C.greenLight, borderWidth: 1.5,
        borderColor: C.green + '33', borderRadius: 16,
        padding: 16, marginBottom: 14,
    },
    tipsTitle: { fontSize: 14, fontWeight: '800', color: C.green, marginBottom: 10 },
    tipItem: { fontSize: 13, color: '#1B4332', lineHeight: 22 },

    /* Activity */
    activitySection: { marginBottom: 14 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: C.brown, marginBottom: 10 },
    emptyActivity: {
        backgroundColor: C.card, borderRadius: 14, borderWidth: 1,
        borderColor: C.border, padding: 20, alignItems: 'center',
    },
    emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 21 },
    activityRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
        borderRadius: 14, padding: 14, marginBottom: 8,
    },
    activityIcon: { fontSize: 22 },
    activityMsg: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
    activityTime: { fontSize: 11, color: C.muted, marginTop: 2 },

    /* Test button */
    testBtn: {
        borderWidth: 1.5, borderColor: C.blue + '55',
        borderRadius: 14, padding: 14, alignItems: 'center',
        backgroundColor: C.blueLight,
    },
    testBtnText: { fontSize: 14, fontWeight: '700', color: C.blue },
    testBtnSub: { fontSize: 11, color: C.muted, marginTop: 3 },

    /* Bluetooth-style connection popup */
    connPopup: {
        position: 'absolute', bottom: 20, left: 14, right: 14,
        backgroundColor: C.white,
        borderWidth: 2, borderRadius: 18,
        paddingVertical: 14, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        elevation: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.18, shadowRadius: 10,
    },
    connPopupDot: {
        width: 8, height: 8, borderRadius: 4,
        position: 'absolute', top: 12, left: 12,
    },
    connPopupIcon: { fontSize: 30 },
    connPopupTitle: { fontSize: 14, fontWeight: '800', lineHeight: 19 },
    connPopupSub:   { fontSize: 12, color: C.muted, marginTop: 1 },
    connPopupClose: { padding: 4, marginLeft: 4 },
});

export default MeshStatusScreen;
