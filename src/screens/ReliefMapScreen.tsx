/**
 * ReliefMapScreen — Find nearest government relief camps
 *
 * Shows cached + live relief camp data sorted by distance.
 * Works offline using pre-cached data from last sync.
 */

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Linking,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { ReliefCamp, sosService } from '../services/sos';

const C = {
    bg: '#EBF4F7', brown: '#2C1A0E', muted: '#8C7060', white: '#FFFFFF',
    green: '#2A7A5A', greenLight: 'rgba(42,122,90,0.12)',
    red: '#D32F2F', orange: '#E05A2B',
    blue: '#1565C0', blueLight: 'rgba(21,101,192,0.10)',
    card: 'rgba(255,255,255,0.95)', border: 'rgba(44,26,14,0.08)',
    amber: '#E65100', amberLight: 'rgba(230,81,0,0.10)',
};

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

type ParamList = {
    ReliefMap: {
        location?: { latitude: number; longitude: number; address?: string } | null;
    };
};
type Props = NativeStackScreenProps<ParamList, 'ReliefMap'>;

const ReliefMapScreen: React.FC<Props> = ({ navigation, route }) => {
    const loc = route.params?.location;
    const [camps, setCamps] = useState<ReliefCamp[]>([]);
    const [loading, setLoading] = useState(true);
    const [fromCache, setFromCache] = useState(false);

    useEffect(() => {
        const userGps = loc ? { latitude: loc.latitude, longitude: loc.longitude } : undefined;
        sosService.getReliefCamps(userGps).then(result => {
            setCamps(result);
            setFromCache(result.length > 0);
            setLoading(false);
        });
    }, []);

    function distanceLabel(camp: ReliefCamp): string {
        if (!loc) return '';
        const d = sosService.distanceKm(
            { latitude: loc.latitude, longitude: loc.longitude },
            camp.gps
        );
        if (d < 1) return `${Math.round(d * 1000)} m away`;
        return `${d.toFixed(1)} km away`;
    }

    function openInMaps(camp: ReliefCamp) {
        Linking.openURL(`https://maps.google.com/?q=${camp.gps.latitude},${camp.gps.longitude}`);
    }

    function occupancyPercent(camp: ReliefCamp): number {
        if (!camp.currentOccupancy || !camp.capacity) return 0;
        return Math.round((camp.currentOccupancy / camp.capacity) * 100);
    }

    const renderCamp = ({ item, index }: { item: ReliefCamp; index: number }) => {
        const pct = occupancyPercent(item);
        const isFull = pct >= 90;
        return (
            <Animated.View entering={FadeInUp.duration(300).delay(index * 60)}>
                <TouchableOpacity
                    style={styles.campCard}
                    activeOpacity={0.85}
                    onPress={() => openInMaps(item)}
                >
                    {/* Distance badge */}
                    {loc && (
                        <View style={styles.distanceBadge}>
                            <Text style={styles.distanceText}>{distanceLabel(item)}</Text>
                        </View>
                    )}

                    <View style={styles.campHeader}>
                        <MapPinIcon color={isFull ? C.amber : C.green} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.campName}>{item.name}</Text>
                            <Text style={styles.campAddress} numberOfLines={1}>
                                {item.gps.address ?? `${item.gps.latitude.toFixed(4)}, ${item.gps.longitude.toFixed(4)}`}
                            </Text>
                        </View>
                    </View>

                    {/* Availability chips */}
                    <View style={styles.chipsRow}>
                        {item.hasFood && <View style={[styles.chip, { backgroundColor: '#E65100' + '18', borderColor: '#E65100' }]}><Text style={[styles.chipText, { color: '#E65100' }]}>🍞 Food</Text></View>}
                        {item.hasWater && <View style={[styles.chip, { backgroundColor: C.blueLight, borderColor: C.blue }]}><Text style={[styles.chipText, { color: C.blue }]}>💧 Water</Text></View>}
                        {item.hasMedical && <View style={[styles.chip, { backgroundColor: C.greenLight, borderColor: C.green }]}><Text style={[styles.chipText, { color: C.green }]}>🩺 Medical</Text></View>}
                        {!item.hasFood && !item.hasWater && !item.hasMedical && (
                            <View style={[styles.chip, { backgroundColor: C.amberLight, borderColor: C.amber }]}>
                                <Text style={[styles.chipText, { color: C.amber }]}>⚠️ Limited</Text>
                            </View>
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
                                {item.currentOccupancy ?? 0}/{item.capacity} {isFull ? '⚠️ Almost Full' : '✅ Available'}
                            </Text>
                        </View>
                    )}

                    <Text style={styles.openMapsHint}>Tap to open in Google Maps →</Text>
                </TouchableOpacity>
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
                    <Text style={styles.headerTitle}>Relief Camps</Text>
                    <Text style={styles.headerSub}>
                        {loading ? 'Loading...' : `${camps.length} camp${camps.length !== 1 ? 's' : ''} found${fromCache ? ' · cached' : ''}`}
                    </Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={C.red} />
                    <Text style={styles.loadingText}>Finding relief camps...</Text>
                </View>
            ) : camps.length === 0 ? (
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyEmoji}>🏕️</Text>
                    <Text style={styles.emptyTitle}>No Camps Found</Text>
                    <Text style={styles.emptySub}>
                        No relief camp data available.{'\n'}This updates automatically when any device in your area has internet.
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
                                🌐 Sorted by distance from your location. Tap any camp to navigate there.
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
    headerTitle: { fontSize: 17, fontWeight: '800', color: C.brown },
    headerSub: { fontSize: 11, color: C.muted, fontWeight: '500', marginTop: 1 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: C.muted, fontWeight: '500' },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 56, marginBottom: 14 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: C.brown, marginBottom: 8 },
    emptySub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },
    list: { padding: 16, paddingBottom: 40 },
    infoBanner: {
        backgroundColor: C.blueLight, borderRadius: 12, padding: 12, marginBottom: 14,
    },
    infoBannerText: { fontSize: 12, color: C.blue, fontWeight: '600', lineHeight: 18 },
    campCard: {
        backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
        borderRadius: 18, padding: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
        position: 'relative',
    },
    distanceBadge: {
        position: 'absolute', top: 12, right: 12,
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
    occupancyWrap: { marginBottom: 8 },
    occupancyBar: {
        height: 6, backgroundColor: 'rgba(44,26,14,0.08)',
        borderRadius: 3, overflow: 'hidden', marginBottom: 4,
    },
    occupancyFill: { height: '100%', borderRadius: 3 },
    occupancyLabel: { fontSize: 11, fontWeight: '600', color: C.muted },
    openMapsHint: { fontSize: 10, color: C.muted, fontWeight: '500', marginTop: 4 },
});

export default ReliefMapScreen;
