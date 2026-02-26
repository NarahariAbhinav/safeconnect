/**
 * ResourceOfferScreen — "I Can Help" disaster coordination
 *
 * Lets a safe person offer food/water/shelter/vehicle to those in need.
 * Works OFFLINE — stored locally, syncs via gateway when internet available.
 * Data appears on Government Dashboard map for aid coordinators.
 */

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ResourceCategory, sosService } from '../services/sos';

// ─── Colors ─────────────────────────────────────────────────────────
const C = {
    bg: '#EBF4F7', brown: '#2C1A0E', muted: '#8C7060', white: '#FFFFFF',
    green: '#2A7A5A', greenLight: 'rgba(42,122,90,0.12)', greenBorder: 'rgba(42,122,90,0.35)',
    border: 'rgba(44,26,14,0.08)', card: 'rgba(255,255,255,0.95)',
    orange: '#E05A2B',
};

// ─── Icons ───────────────────────────────────────────────────────────
const BackIcon = () => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M12 19l-7-7 7-7" stroke={C.brown} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

// ─── Resource Options ────────────────────────────────────────────────
const RESOURCES: { key: ResourceCategory; emoji: string; label: string; color: string; desc: string }[] = [
    { key: 'food', emoji: '🍞', label: 'Food', color: '#E65100', desc: 'Cooked meals or dry rations' },
    { key: 'water', emoji: '💧', label: 'Water', color: '#1565C0', desc: 'Clean drinking water' },
    { key: 'medicine', emoji: '💊', label: 'Medicine', color: '#C62828', desc: 'First aid or medications' },
    { key: 'shelter', emoji: '🏠', label: 'Shelter', color: '#4527A0', desc: 'Safe place to stay' },
    { key: 'vehicle', emoji: '🚗', label: 'Vehicle', color: '#1B5E20', desc: 'Transport / evacuation' },
    { key: 'medical_skills', emoji: '🩺', label: 'Medical Skills', color: '#01579B', desc: 'Doctor / nurse / first aid' },
    { key: 'space', emoji: '🛏️', label: 'Extra Space', color: '#4A148C', desc: 'House / building space' },
];

// ─── Types ───────────────────────────────────────────────────────────
type ParamList = {
    ResourceOffer: {
        userId: string;
        userName: string;
        location?: { latitude: number; longitude: number; address?: string } | null;
    };
};
type Props = NativeStackScreenProps<ParamList, 'ResourceOffer'>;

// ─── Screen ──────────────────────────────────────────────────────────
const ResourceOfferScreen: React.FC<Props> = ({ navigation, route }) => {
    const { userId, userName, location } = route.params;

    const [selectedResources, setSelectedResources] = useState<ResourceCategory[]>([]);
    const [capacity, setCapacity] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const toggle = (key: ResourceCategory) => {
        setSelectedResources(prev =>
            prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]
        );
    };

    const submit = async () => {
        if (selectedResources.length === 0) {
            Alert.alert('Select Resources', 'Please select at least one resource you can offer.');
            return;
        }
        setSubmitting(true);
        try {
            await sosService.offerResource(
                userId,
                userName,
                {
                    latitude: location?.latitude ?? 0,
                    longitude: location?.longitude ?? 0,
                    address: location?.address,
                },
                selectedResources,
                capacity ? parseInt(capacity) : undefined,
                notes.trim() || undefined
            );
            setSubmitted(true);
            await sosService.flushSyncQueue();
        } catch {
            Alert.alert('Error', 'Could not save. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Success State ──
    if (submitted) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <View style={styles.successWrap}>
                    <Animated.View entering={FadeInDown.duration(600)} style={styles.successCard}>
                        <Text style={styles.successEmoji}>🤝</Text>
                        <Text style={styles.successTitle}>Thank You!</Text>
                        <Text style={styles.successSub}>
                            Your offer has been saved and will sync to the coordination dashboard automatically. Relief coordinators may contact you soon.
                        </Text>
                        <View style={styles.successChips}>
                            {selectedResources.map(r => {
                                const item = RESOURCES.find(x => x.key === r)!;
                                return (
                                    <View key={r} style={[styles.successChip, { backgroundColor: item.color + '18' }]}>
                                        <Text style={[styles.successChipText, { color: item.color }]}>
                                            {item.emoji} {item.label}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()} activeOpacity={0.82}>
                            <Text style={styles.doneBtnText}>Back to Emergency Hub</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <BackIcon />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>I Can Help</Text>
                    <Text style={styles.headerSub}>Offer resources to those in need</Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                {/* Hero */}
                <Animated.View entering={FadeInDown.duration(400)} style={styles.heroBanner}>
                    <Text style={styles.heroBannerTitle}>🌟 You're a lifesaver</Text>
                    <Text style={styles.heroBannerSub}>
                        Your location and offer will be shared with relief coordinators. They will match you with people who need your help.
                    </Text>
                </Animated.View>

                {/* Location */}
                <View style={styles.locationCard}>
                    <Text style={styles.locationLabel}>📍 Your location</Text>
                    <Text style={styles.locationText} numberOfLines={1}>
                        {location?.address ?? (location
                            ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                            : 'Location not available')}
                    </Text>
                </View>

                {/* Resource selection */}
                <Animated.View entering={FadeInUp.duration(400).delay(80)} style={styles.section}>
                    <Text style={styles.sectionTitle}>WHAT CAN YOU OFFER?</Text>
                    <Text style={styles.sectionSub}>Select all that apply</Text>
                    {RESOURCES.map((item, i) => {
                        const selected = selectedResources.includes(item.key);
                        return (
                            <TouchableOpacity
                                key={item.key}
                                style={[
                                    styles.resourceRow,
                                    selected && { borderColor: item.color, backgroundColor: item.color + '0E' },
                                ]}
                                onPress={() => toggle(item.key)}
                                activeOpacity={0.78}
                            >
                                <Text style={styles.resourceEmoji}>{item.emoji}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.resourceLabel, selected && { color: item.color }]}>
                                        {item.label}
                                    </Text>
                                    <Text style={styles.resourceDesc}>{item.desc}</Text>
                                </View>
                                <View style={[
                                    styles.checkbox,
                                    selected && { backgroundColor: item.color, borderColor: item.color },
                                ]}>
                                    {selected && <Text style={styles.checkmark}>✓</Text>}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </Animated.View>

                {/* Capacity */}
                <Animated.View entering={FadeInUp.duration(400).delay(140)} style={styles.section}>
                    <Text style={styles.sectionTitle}>CAPACITY (OPTIONAL)</Text>
                    <Text style={styles.sectionSub}>How many people can you help?</Text>
                    <TextInput
                        style={styles.capacityInput}
                        placeholder="e.g. 5"
                        placeholderTextColor={C.muted}
                        value={capacity}
                        onChangeText={setCapacity}
                        keyboardType="number-pad"
                        maxLength={4}
                    />
                </Animated.View>

                {/* Notes */}
                <Animated.View entering={FadeInUp.duration(400).delay(180)} style={styles.section}>
                    <Text style={styles.sectionTitle}>ADDITIONAL DETAILS (OPTIONAL)</Text>
                    <TextInput
                        style={styles.notesInput}
                        placeholder="e.g. Can cook for 10 people, have vehicle with 4 seats, available till 8 PM..."
                        placeholderTextColor={C.muted}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={3}
                        maxLength={300}
                    />
                </Animated.View>

                {/* Offline note */}
                <View style={styles.offlineNote}>
                    <Text style={styles.offlineNoteText}>
                        📵 Works offline — syncs to coordination dashboard when internet is available
                    </Text>
                </View>

                {/* Submit */}
                <TouchableOpacity
                    style={[styles.submitBtn, selectedResources.length === 0 && styles.submitBtnDisabled]}
                    onPress={submit}
                    activeOpacity={0.85}
                    disabled={submitting || selectedResources.length === 0}
                >
                    <Text style={styles.submitBtnText}>
                        {submitting ? 'Submitting...' : '🤝 Submit My Offer'}
                    </Text>
                </TouchableOpacity>

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
    headerTitle: { fontSize: 17, fontWeight: '800', color: C.brown },
    headerSub: { fontSize: 11, color: C.muted, fontWeight: '500', marginTop: 1 },

    scroll: { padding: 16, paddingBottom: 40 },

    heroBanner: {
        backgroundColor: C.greenLight, borderWidth: 1.5, borderColor: C.greenBorder,
        borderRadius: 16, padding: 16, marginBottom: 14,
    },
    heroBannerTitle: { fontSize: 16, fontWeight: '800', color: C.green, marginBottom: 6 },
    heroBannerSub: { fontSize: 12, color: C.green, lineHeight: 18, opacity: 0.8 },

    locationCard: {
        backgroundColor: C.green, borderRadius: 12, padding: 12, marginBottom: 20,
    },
    locationLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
    locationText: { fontSize: 13, fontWeight: '600', color: C.white },

    section: { marginBottom: 22 },
    sectionTitle: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1, marginBottom: 4 },
    sectionSub: { fontSize: 12, color: C.muted, marginBottom: 12 },

    resourceRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
        borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    },
    resourceEmoji: { fontSize: 24 },
    resourceLabel: { fontSize: 14, fontWeight: '700', color: C.brown, marginBottom: 2 },
    resourceDesc: { fontSize: 11, color: C.muted, fontWeight: '500' },
    checkbox: {
        width: 24, height: 24, borderRadius: 7,
        borderWidth: 2, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    checkmark: { fontSize: 13, color: C.white, fontWeight: '900' },

    capacityInput: {
        borderWidth: 1.5, borderColor: C.border, borderRadius: 14,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 16, color: C.brown, backgroundColor: C.card,
        fontWeight: '700',
    },

    notesInput: {
        borderWidth: 1.5, borderColor: C.border, borderRadius: 14,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 13, color: C.brown, backgroundColor: C.card,
        minHeight: 80, textAlignVertical: 'top',
    },

    offlineNote: {
        backgroundColor: 'rgba(44,26,14,0.05)', borderRadius: 10,
        padding: 10, marginBottom: 20, alignItems: 'center',
    },
    offlineNoteText: { fontSize: 11, color: C.muted, fontWeight: '500' },

    submitBtn: {
        backgroundColor: C.green, borderRadius: 50,
        paddingVertical: 16, alignItems: 'center',
        shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    },
    submitBtnDisabled: { backgroundColor: 'rgba(44,26,14,0.15)', shadowOpacity: 0, elevation: 0 },
    submitBtnText: { fontSize: 16, fontWeight: '800', color: C.white },

    // Success
    successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    successCard: {
        backgroundColor: C.white, borderRadius: 24, padding: 28, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08, shadowRadius: 20, elevation: 8,
    },
    successEmoji: { fontSize: 64, marginBottom: 16 },
    successTitle: { fontSize: 22, fontWeight: '900', color: C.brown, marginBottom: 10 },
    successSub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    successChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24 },
    successChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    successChipText: { fontSize: 13, fontWeight: '700' },
    doneBtn: {
        backgroundColor: C.green, borderRadius: 50,
        paddingVertical: 14, paddingHorizontal: 28,
    },
    doneBtnText: { fontSize: 15, fontWeight: '700', color: C.white },
});

export default ResourceOfferScreen;
