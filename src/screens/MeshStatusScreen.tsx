/**
 * MeshStatusScreen.tsx — Live BLE Mesh Debug & Monitor
 *
 * Shows in real-time:
 *  • BLE adapter state (On/Off/Scanning)
 *  • Nearby SafeConnect devices discovered
 *  • Packets received (type, hops, origin)
 *  • Gateway sync status
 *  • Relay queue size
 */

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { bleMeshService, MeshPacket } from '../services/ble/BLEMeshService';

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

interface LogEntry {
    id: string;
    time: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'packet';
    message: string;
}

const MeshStatusScreen: React.FC<Props> = ({ navigation, route }) => {
    const { userId, userName } = route.params;

    const [bleReady, setBleReady] = useState<boolean | null>(null);  // null = initialising
    const [scanning, setScanning] = useState(false);
    const [packets, setPackets] = useState<MeshPacket[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const logRef = useRef(logs);
    logRef.current = logs;

    const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
        const entry: LogEntry = {
            id: `${Date.now()}_${Math.random()}`,
            time: new Date().toLocaleTimeString(),
            type,
            message: msg,
        };
        setLogs(prev => [entry, ...prev].slice(0, 80));
    };

    // ── Init BLE ──────────────────────────────────────────────────────
    useEffect(() => {
        addLog('Initialising BLE adapter...', 'info');
        bleMeshService.init().then(ready => {
            setBleReady(ready);
            if (ready) {
                addLog('BLE adapter ready ✅', 'success');
            } else {
                addLog('BLE unavailable — enable Bluetooth and grant permissions', 'error');
            }
        });

        return () => {
            bleMeshService.stopScanning();
        };
    }, []);

    // ── Start scanning ────────────────────────────────────────────────
    const startScan = async () => {
        if (!bleReady) {
            Alert.alert('BLE Not Ready', 'Enable Bluetooth and grant permissions first.');
            return;
        }
        setScanning(true);
        addLog('Scanning for nearby SafeConnect devices...', 'info');

        await bleMeshService.startScanning((pkt: MeshPacket) => {
            addLog(`📦 Packet received! Type: ${pkt.type}  Hops: ${pkt.hops}  From: ${pkt.origin.slice(0, 8)}...`, 'packet');
            setPackets(prev => {
                if (prev.find(p => p.id === pkt.id)) return prev;
                return [pkt, ...prev];
            });
        });
    };

    const stopScan = () => {
        bleMeshService.stopScanning();
        setScanning(false);
        addLog('Scan stopped', 'info');
    };

    // ── Send a test SOS packet ────────────────────────────────────────
    const sendTestPacket = async () => {
        if (!bleReady) {
            Alert.alert('BLE Not Ready');
            return;
        }
        addLog('Broadcasting TEST SOS packet via BLE...', 'info');
        const pkt = bleMeshService.createSOSPacket(userId, {
            userId,
            userName,
            gps: { latitude: 19.076, longitude: 72.877, address: 'Test location' },
            activatedAt: Date.now(),
            isActive: true,
            contactsNotified: [],
            synced: false,
            isTestPacket: true,
        });
        await bleMeshService.broadcast(pkt);
        addLog('Test SOS packet broadcast complete ✅', 'success');
        setPackets(prev => [pkt, ...prev]);
    };

    // ── Helpers ────────────────────────────────────────────────────────
    const logColor = (type: LogEntry['type']) => {
        switch (type) {
            case 'success': return C.green;
            case 'error': return C.red;
            case 'warning': return C.orange;
            case 'packet': return C.blue;
            default: return C.muted;
        }
    };

    const statusColor = bleReady === null ? C.orange : bleReady ? C.green : C.red;
    const statusLabel = bleReady === null ? '⏳ Initialising...' : bleReady ? '✅ BLE Ready' : '❌ BLE Unavailable';

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <BackIcon />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={s.headerTitle}>BLE Mesh Monitor</Text>
                    <Text style={s.headerSub}>Real-time mesh network status</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
                    <Text style={[s.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

                {/* ── Stats Row ── */}
                <Animated.View entering={FadeInDown.duration(400)} style={s.statsRow}>
                    {[
                        { label: 'Packets\nReceived', value: `${packets.length}`, color: C.blue },
                        { label: 'Active\nScan', value: scanning ? 'ON' : 'OFF', color: scanning ? C.green : C.muted },
                        { label: 'Log\nEntries', value: `${logs.length}`, color: C.orange },
                        { label: 'BLE\nStatus', value: bleReady ? 'ON' : bleReady === null ? '...' : 'OFF', color: statusColor },
                    ].map(stat => (
                        <View key={stat.label} style={s.statCard}>
                            <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
                            <Text style={s.statLabel}>{stat.label}</Text>
                        </View>
                    ))}
                </Animated.View>

                {/* ── Control Buttons ── */}
                <Animated.View entering={FadeInUp.duration(400).delay(80)} style={s.controls}>
                    {!scanning ? (
                        <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: C.green }]}
                            onPress={startScan} activeOpacity={0.85} disabled={bleReady !== true}>
                            <Text style={s.ctrlBtnText}>📡 Start Scanning</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: C.red }]}
                            onPress={stopScan} activeOpacity={0.85}>
                            <Text style={s.ctrlBtnText}>⏹ Stop Scanning</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: C.blue }]}
                        onPress={sendTestPacket} activeOpacity={0.85} disabled={bleReady !== true}>
                        <Text style={s.ctrlBtnText}>🧪 Send Test SOS</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* ── How to Test ── */}
                <Animated.View entering={FadeInUp.duration(400).delay(120)} style={s.testGuide}>
                    <Text style={s.testGuideTitle}>📋 How to Test</Text>
                    <Text style={s.testGuideText}>
                        {'1️⃣  Install this dev build on 2 Android phones\n'}
                        {'2️⃣  Both phones: Bluetooth ON\n'}
                        {'3️⃣  Phone A: tap "Start Scanning"\n'}
                        {'4️⃣  Phone B: tap "Send Test SOS"\n'}
                        {'5️⃣  Phone A should show packet received ✅\n'}
                        {'6️⃣  Airplane Mode ON → repeat → still works! 📵'}
                    </Text>
                </Animated.View>

                {/* ── Received Packets ── */}
                {packets.length > 0 && (
                    <Animated.View entering={FadeInUp.duration(400)} style={s.section}>
                        <Text style={s.sectionTitle}>📦 RECEIVED PACKETS ({packets.length})</Text>
                        {packets.map((pkt, i) => (
                            <View key={pkt.id} style={s.packetCard}>
                                <View style={s.packetRow}>
                                    <View style={[s.typeBadge, { backgroundColor: C.blue + '22' }]}>
                                        <Text style={[s.typeBadgeText, { color: C.blue }]}>{pkt.type.toUpperCase()}</Text>
                                    </View>
                                    <Text style={s.packetHops}>Hops: {pkt.hops}</Text>
                                    <Text style={s.packetTime}>
                                        {new Date(pkt.createdAt).toLocaleTimeString()}
                                    </Text>
                                </View>
                                <Text style={s.packetOrigin}>From: {pkt.origin.slice(0, 16)}...</Text>
                                <Text style={s.packetId}>ID: {pkt.id}</Text>
                            </View>
                        ))}
                    </Animated.View>
                )}

                {/* ── Live Log ── */}
                <Animated.View entering={FadeInUp.duration(400).delay(160)} style={s.section}>
                    <Text style={s.sectionTitle}>🖥 LIVE LOG</Text>
                    <View style={s.logBox}>
                        {logs.length === 0 ? (
                            <Text style={s.logEmpty}>No log entries yet. Start scanning to see activity.</Text>
                        ) : logs.map(entry => (
                            <View key={entry.id} style={s.logEntry}>
                                <Text style={s.logTime}>{entry.time}</Text>
                                <Text style={[s.logMsg, { color: logColor(entry.type) }]}>{entry.message}</Text>
                            </View>
                        ))}
                    </View>
                </Animated.View>

                {/* ── Info ── */}
                <View style={s.infoBox}>
                    <Text style={s.infoText}>
                        {'⚡ This screen requires the Expo Development Build (not Expo Go).\n'}
                        {'📵 BLE communication works completely offline — no WiFi or cellular needed.\n'}
                        {'🔗 Service UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b'}
                    </Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 16, paddingBottom: 40 },

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
    statusBadge: {
        borderWidth: 1.5, borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 4,
    },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },

    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    statCard: {
        flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
        borderRadius: 14, padding: 12, alignItems: 'center',
    },
    statValue: { fontSize: 22, fontWeight: '900' },
    statLabel: { fontSize: 10, color: C.muted, fontWeight: '600', textAlign: 'center', marginTop: 2 },

    controls: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    ctrlBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    ctrlBtnText: { fontSize: 14, fontWeight: '800', color: C.white },

    testGuide: {
        backgroundColor: C.greenLight, borderWidth: 1.5,
        borderColor: 'rgba(42,122,90,0.3)', borderRadius: 14,
        padding: 14, marginBottom: 14,
    },
    testGuideTitle: { fontSize: 14, fontWeight: '800', color: C.green, marginBottom: 8 },
    testGuideText: { fontSize: 13, color: '#1B4332', lineHeight: 22 },

    section: { marginBottom: 14 },
    sectionTitle: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1, marginBottom: 8 },

    packetCard: {
        backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
        borderRadius: 12, padding: 12, marginBottom: 8,
    },
    packetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    typeBadgeText: { fontSize: 11, fontWeight: '700' },
    packetHops: { fontSize: 12, color: C.muted, fontWeight: '600' },
    packetTime: { marginLeft: 'auto', fontSize: 11, color: C.muted },
    packetOrigin: { fontSize: 12, color: C.brown, fontWeight: '600', marginBottom: 2 },
    packetId: { fontSize: 10, color: C.muted, fontFamily: 'monospace' },

    logBox: {
        backgroundColor: '#0F1117', borderRadius: 14,
        padding: 12, maxHeight: 300,
    },
    logEmpty: { fontSize: 12, color: '#666', fontStyle: 'italic' },
    logEntry: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    logTime: { fontSize: 10, color: '#555', fontFamily: 'monospace', minWidth: 60 },
    logMsg: { fontSize: 11, flex: 1, fontFamily: 'monospace' },

    infoBox: {
        backgroundColor: 'rgba(44,26,14,0.05)',
        borderRadius: 12, padding: 12, marginBottom: 8,
    },
    infoText: { fontSize: 11, color: C.muted, lineHeight: 18 },
});

export default MeshStatusScreen;
