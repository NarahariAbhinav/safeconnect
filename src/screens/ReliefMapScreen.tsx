/**
 * ReliefMapScreen — Find nearest government relief camps
 *
 * Shows cached + live relief camp data sorted by distance.
 * Works offline using pre-cached data from last sync.
 *
 * Actions per camp:
 *  • 🗺 Navigate  → Opens Google Maps directions
 *  • 📱 I'm Going → Sends SMS to trusted contacts with camp name + maps link
 *  • 📋 Details   → Expandable detail sheet (resources, capacity, medical)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SMS from 'expo-sms';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Linking,
    StyleSheet,
    TouchableOpacity,
    Vibration,
    View,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { downloadOfflineTiles, getTilePath } from '../services/OfflineMapHelper';
import { ReliefCamp, sosService } from '../services/sos';

const C = {
    bg: '#EBF4F7', brown: '#2C1A0E', muted: '#8C7060', white: '#FFFFFF',
    green: '#2A7A5A', greenLight: 'rgba(42,122,90,0.12)', greenBorder: 'rgba(42,122,90,0.25)',
    red: '#D32F2F', redLight: 'rgba(211,47,47,0.10)',
    orange: '#E05A2B', orangeLight: 'rgba(224,90,43,0.12)',
    blue: '#1565C0', blueLight: 'rgba(21,101,192,0.10)',
    card: 'rgba(255,255,255,0.97)', border: 'rgba(44,26,14,0.08)',
    amber: '#E65100', amberLight: 'rgba(230,81,0,0.10)',
    purple: '#6A1B9A', purpleLight: 'rgba(106,27,154,0.10)',
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const BackIcon = () => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M12 19l-7-7 7-7" stroke={C.brown} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const MapPinIcon: React.FC<{ color?: string }> = ({ color = C.red }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={color} strokeWidth="1.8" fill={color + '22'} />
        <Circle cx="12" cy="9" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
    </Svg>
);
const NavIcon = () => (
    <Svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <Path d="M12 2L19 12H12V22L5 12H12V2Z" stroke={C.white} strokeWidth="2" fill={C.white} strokeLinejoin="round" />
    </Svg>
);
const SmsIcon = () => (
    <Svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const InfoIcon = () => (
    <Svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={C.blue} strokeWidth="1.8" />
        <Path d="M12 16v-4M12 8h.01" stroke={C.blue} strokeWidth="2" strokeLinecap="round" />
    </Svg>
);

type ParamList = {
    ReliefMap: {
        location?: { latitude: number; longitude: number; address?: string } | null;
    };
};
type Props = NativeStackScreenProps<ParamList, 'ReliefMap'>;

const KEY_TRUSTED = 'safeconnect_trusted_contacts';

const ReliefMapScreen: React.FC<Props> = ({ navigation, route }) => {
    const loc = route.params?.location ?? null;
    const [camps, setCamps] = useState<ReliefCamp[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [goingId, setGoingId] = useState<string | null>(null); // camp user marked as going

    useEffect(() => {
        const userGps = loc ? { latitude: loc.latitude, longitude: loc.longitude } : undefined;
        sosService.getReliefCamps(userGps).then(result => {
            setCamps(result);
            setLoading(false);
            if (userGps) {
                // Pre-cache tiles around user when internet is available
                downloadOfflineTiles(userGps.latitude, userGps.longitude);
            }
        });
    }, []);

    function distanceLabel(camp: ReliefCamp): string {
        if (!loc || !camp.gps) return '';
        const R = 6371;
        const dLat = ((camp.gps.latitude - loc.latitude) * Math.PI) / 180;
        const dLon = ((camp.gps.longitude - loc.longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((loc.latitude * Math.PI) / 180) *
            Math.cos((camp.gps.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
        const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (d < 1) return `${Math.round(d * 1000)} m away`;
        return `${d.toFixed(1)} km away`;
    }

    function openInMaps(camp: ReliefCamp) {
        if (!camp.gps) return;
        Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${camp.gps.latitude},${camp.gps.longitude}&travelmode=walking`
        );
    }

    function occupancyPercent(camp: ReliefCamp): number {
        if (!camp.currentOccupancy || !camp.capacity) return 0;
        return Math.round((camp.currentOccupancy / camp.capacity) * 100);
    }

    async function imGoingThere(camp: ReliefCamp) {
        Vibration.vibrate(80);
        setGoingId(camp.id);

        try {
            // Load trusted contacts for SMS
            const raw = await AsyncStorage.getItem(KEY_TRUSTED);
            const contacts: any[] = raw ? JSON.parse(raw) : [];
            const phones = contacts.map(c => c.phone).filter(Boolean);

            const mapsLink = camp.gps
                ? `https://maps.google.com/?q=${camp.gps.latitude},${camp.gps.longitude}`
                : '';
            const address = camp.gps?.address ?? mapsLink;
            const pct = occupancyPercent(camp);
            const availability = pct >= 90 ? '⚠️ Almost Full' : `✅ ${pct}% occupied — space available`;

            const message =
                `🏕️ I am heading to a relief camp for safety:\n` +
                `📍 ${camp.name}\n` +
                `${address}\n` +
                `${availability}\n` +
                (camp.hasFood ? `🍞 Food  ` : '') +
                (camp.hasWater ? `💧 Water  ` : '') +
                (camp.hasMedical ? `🩺 Medical  ` : '') + '\n' +
                (mapsLink ? `🗺 Navigate: ${mapsLink}\n` : '') +
                `\nSent via SafeConnect`;

            if (phones.length > 0) {
                const isAvail = await SMS.isAvailableAsync();
                if (isAvail) {
                    await SMS.sendSMSAsync(phones, message);
                    Alert.alert(
                        '✅ Contacts Notified!',
                        `Your ${phones.length} trusted contact${phones.length > 1 ? 's have' : ' has'} been sent your destination.\n\nNow navigate to: ${camp.name}`,
                        [
                            { text: 'Navigate Now 🗺', onPress: () => openInMaps(camp) },
                            { text: 'OK' },
                        ]
                    );
                    return;
                }
            }

            // No contacts or SMS not available — just navigate
            Alert.alert(
                '🏕️ Going to Camp',
                `Navigating to ${camp.name}.\n\nAdd trusted contacts in the app to notify them automatically next time.`,
                [
                    { text: 'Navigate Now →', onPress: () => openInMaps(camp) },
                    { text: 'Cancel', style: 'cancel' },
                ]
            );
        } catch (e) {
            openInMaps(camp); // fallback
        }
    }

    const renderCamp = ({ item, index }: { item: ReliefCamp; index: number }) => {
        const pct = occupancyPercent(item);
        const isFull = pct >= 90;
        const isExpanded = expandedId === item.id;
        const isGoing = goingId === item.id;
        const dist = distanceLabel(item);

        return (
            <Animated.View entering={FadeInUp.duration(300).delay(index * 70)}>
                <View style={[styles.campCard, isGoing && styles.campCardGoing]}>

                    {/* Going banner */}
                    {isGoing && (
                        <View style={styles.goingBanner}>
                            <Text style={styles.goingBannerText}>🏃 You're heading here</Text>
                        </View>
                    )}

                    {/* Distance badge */}
                    {dist !== '' && (
                        <View style={styles.distanceBadge}>
                            <Text style={styles.distanceText}>{dist}</Text>
                        </View>
                    )}

                    {/* Header */}
                    <View style={styles.campHeader}>
                        <MapPinIcon color={isFull ? C.amber : C.green} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.campName}>{item.name}</Text>
                            <Text style={styles.campAddress} numberOfLines={1}>
                                {item.gps?.address ?? (item.gps
                                    ? `${item.gps.latitude.toFixed(4)}, ${item.gps.longitude.toFixed(4)}`
                                    : 'Location unavailable')}
                            </Text>
                        </View>
                    </View>

                    {/* Resource chips */}
                    <View style={styles.chipsRow}>
                        {item.hasFood && <View style={[styles.chip, { backgroundColor: C.amberLight, borderColor: C.amber }]}><Text style={[styles.chipText, { color: C.amber }]}>🍞 Food</Text></View>}
                        {item.hasWater && <View style={[styles.chip, { backgroundColor: C.blueLight, borderColor: C.blue }]}><Text style={[styles.chipText, { color: C.blue }]}>💧 Water</Text></View>}
                        {item.hasMedical && <View style={[styles.chip, { backgroundColor: C.greenLight, borderColor: C.green }]}><Text style={[styles.chipText, { color: C.green }]}>🩺 Medical</Text></View>}
                        {!item.hasFood && !item.hasWater && !item.hasMedical && (
                            <View style={[styles.chip, { backgroundColor: C.amberLight, borderColor: C.amber }]}><Text style={[styles.chipText, { color: C.amber }]}>⚠️ Limited</Text></View>
                        )}
                    </View>

                    {/* Occupancy bar */}
                    {item.capacity > 0 && (
                        <View style={styles.occupancyWrap}>
                            <View style={styles.occupancyBar}>
                                <View style={[
                                    styles.occupancyFill,
                                    { width: `${Math.min(pct, 100)}%` as any, backgroundColor: isFull ? C.amber : C.green }
                                ]} />
                            </View>
                            <Text style={styles.occupancyLabel}>
                                {item.currentOccupancy ?? 0}/{item.capacity} · {isFull ? '⚠️ Almost Full' : '✅ Space Available'}
                            </Text>
                        </View>
                    )}

                    {/* Expandable details */}
                    {isExpanded && (
                        <View style={styles.detailBox}>
                            <Text style={styles.detailTitle}>📋 Camp Details</Text>
                            {item.capacity > 0 && <Text style={styles.detailRow}>👥 Capacity: {item.capacity} people ({pct}% full)</Text>}
                            <Text style={styles.detailRow}>🍞 Food: {item.hasFood ? 'Available' : 'Not available'}</Text>
                            <Text style={styles.detailRow}>💧 Water: {item.hasWater ? 'Available' : 'Not available'}</Text>
                            <Text style={styles.detailRow}>🩺 Medical: {item.hasMedical ? 'Available' : 'Not available'}</Text>
                            {item.gps && (
                                <Text style={styles.detailRow}>
                                    📍 GPS: {item.gps.latitude.toFixed(5)}, {item.gps.longitude.toFixed(5)}
                                </Text>
                            )}
                            <Text style={styles.detailHint}>
                                💡 Tap "I'm Going There" to alert your trusted contacts and get directions.
                            </Text>
                        </View>
                    )}

                    {/* ── Action Buttons ── */}
                    <View style={styles.actionRow}>
                        {/* Navigate */}
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnGreen]}
                            activeOpacity={0.82}
                            onPress={() => openInMaps(item)}
                        >
                            <NavIcon />
                            <Text style={styles.actionBtnText}>Navigate</Text>
                        </TouchableOpacity>

                        {/* I'm Going There */}
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnOrange, isGoing && styles.actionBtnGoing]}
                            activeOpacity={0.82}
                            onPress={() => imGoingThere(item)}
                        >
                            <SmsIcon />
                            <Text style={styles.actionBtnText}>
                                {isGoing ? '✓ Notified' : "I'm Going"}
                            </Text>
                        </TouchableOpacity>

                        {/* Info toggle */}
                        <TouchableOpacity
                            style={[styles.actionBtnInfo, isExpanded && styles.actionBtnInfoActive]}
                            activeOpacity={0.82}
                            onPress={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                            <InfoIcon />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <BackIcon />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>⛺ Relief Camps</Text>
                    <Text style={styles.headerSub}>
                        {loading ? 'Loading...' : `${camps.length} camp${camps.length !== 1 ? 's' : ''} found · Tap "I'm Going" to alert contacts`}
                    </Text>
                </View>
            </View>

            {/* Offline Map view */}
            {!loading && loc && (
                <View style={styles.mapContainer}>
                    <MapView
                        style={{ flex: 1 }}
                        initialRegion={{
                            latitude: loc.latitude,
                            longitude: loc.longitude,
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05,
                        }}
                    >
                        {/* Caching Offline Tiles generated by the app */}
                        <UrlTile
                            urlTemplate={getTilePath()}
                            maximumZ={14}
                            offlineMode={true}
                        />
                        <Marker coordinate={{ latitude: loc.latitude, longitude: loc.longitude }} pinColor="blue" title="You" />
                        {camps.map(c => c.gps && (
                            <Marker key={c.id} coordinate={{ latitude: c.gps.latitude, longitude: c.gps.longitude }} title={c.name} />
                        ))}
                    </MapView>
                </View>
            )}

            {loading ? (
                <View style={styles.loadingWrap}>
                    <Text style={styles.loadingEmoji}>🏕️</Text>
                    <Text style={styles.loadingText}>Finding relief camps...</Text>
                </View>
            ) : camps.length === 0 ? (
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyEmoji}>🏕️</Text>
                    <Text style={styles.emptyTitle}>No Camps Found</Text>
                    <Text style={styles.emptySub}>
                        No relief camp data available.{'\n'}Updates automatically when any device in your area has internet.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={camps}
                    keyExtractor={c => c.id}
                    renderItem={renderCamp}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        <Animated.View entering={FadeInDown.duration(400)} style={styles.infoBanner}>
                            <Text style={styles.infoBannerText}>
                                🗺️ Sorted by distance · Tap <Text style={{ fontWeight: '800' }}>"I'm Going"</Text> on a camp to automatically SMS your trusted contacts & get directions.
                            </Text>
                        </Animated.View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

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
    mapContainer: { height: 250, width: '100%', marginBottom: 10, borderWidth: 1, borderColor: C.border },
    headerTitle: { fontSize: 17, fontWeight: '800', color: C.brown },
    headerSub: { fontSize: 11, color: C.muted, fontWeight: '500', marginTop: 1 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingEmoji: { fontSize: 48 },
    loadingText: { fontSize: 14, color: C.muted, fontWeight: '500' },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 56, marginBottom: 14 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: C.brown, marginBottom: 8 },
    emptySub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },
    list: { padding: 16, paddingBottom: 40 },
    infoBanner: {
        backgroundColor: C.blueLight, borderRadius: 12, padding: 12, marginBottom: 14,
        borderWidth: 1, borderColor: C.blue + '30',
    },
    infoBannerText: { fontSize: 12, color: C.blue, fontWeight: '600', lineHeight: 18 },

    // Camp card
    campCard: {
        backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
        borderRadius: 18, padding: 16, marginBottom: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
    },
    campCardGoing: { borderColor: C.green, borderWidth: 2 },
    goingBanner: {
        backgroundColor: C.greenLight, borderRadius: 8, paddingHorizontal: 10,
        paddingVertical: 5, marginBottom: 10, alignSelf: 'flex-start',
    },
    goingBannerText: { fontSize: 11, fontWeight: '700', color: C.green },
    distanceBadge: {
        position: 'absolute', top: 14, right: 14,
        backgroundColor: 'rgba(44,26,14,0.07)', borderRadius: 20,
        paddingHorizontal: 10, paddingVertical: 4,
    },
    distanceText: { fontSize: 11, fontWeight: '700', color: C.muted },
    campHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
    campName: { fontSize: 15, fontWeight: '800', color: C.brown, letterSpacing: -0.3, paddingRight: 60 },
    campAddress: { fontSize: 11, fontWeight: '500', color: C.muted, marginTop: 2 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    chipText: { fontSize: 11, fontWeight: '700' },
    occupancyWrap: { marginBottom: 12 },
    occupancyBar: {
        height: 6, backgroundColor: 'rgba(44,26,14,0.08)',
        borderRadius: 3, overflow: 'hidden', marginBottom: 4,
    },
    occupancyFill: { height: '100%', borderRadius: 3 },
    occupancyLabel: { fontSize: 11, fontWeight: '600', color: C.muted },

    // Detail section
    detailBox: {
        backgroundColor: 'rgba(21,101,192,0.06)', borderRadius: 12,
        padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.blue + '25',
    },
    detailTitle: { fontSize: 13, fontWeight: '800', color: C.brown, marginBottom: 8 },
    detailRow: { fontSize: 12, color: C.brown, fontWeight: '500', marginBottom: 5, lineHeight: 18 },
    detailHint: { fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 6, lineHeight: 16 },

    // Action buttons
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 5, paddingVertical: 10, borderRadius: 12,
    },
    actionBtnGreen: { backgroundColor: C.green },
    actionBtnOrange: { backgroundColor: C.orange },
    actionBtnGoing: { backgroundColor: C.green },
    actionBtnText: { fontSize: 13, fontWeight: '700', color: C.white },
    actionBtnInfo: {
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: C.blueLight, borderWidth: 1.5, borderColor: C.blue + '40',
        alignItems: 'center', justifyContent: 'center',
    },
    actionBtnInfoActive: { backgroundColor: C.blue + '25', borderColor: C.blue },
});

export default ReliefMapScreen;
