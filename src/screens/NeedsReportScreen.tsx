/**
 * NeedsReportScreen — "I Need Help" disaster coordination
 *
 * Lets a person report what they need (food/water/medicine/rescue).
 * Works OFFLINE — stored locally, syncs via gateway when internet available.
 * Data appears on Government Dashboard map.
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
import { NeedCategory, sosService } from '../services/sos';

const C = {
    bg: '#EBF4F7', red: '#D32F2F', redLight: 'rgba(211,47,47,0.10)',
    brown: '#2C1A0E', muted: '#8C7060', white: '#FFFFFF',
    green: '#2A7A5A', greenLight: 'rgba(42,122,90,0.12)',
    orange: '#E05A2B', card: 'rgba(255,255,255,0.95)',
    border: 'rgba(44,26,14,0.08)',
};

const BackIcon = () => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M12 19l-7-7 7-7" stroke={C.brown} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const NEEDS: { key: NeedCategory; emoji: string; label: string; color: string }[] = [
    { key: 'food', emoji: '🍞', label: 'Food', color: '#E65100' },
    { key: 'water', emoji: '💧', label: 'Water', color: '#1565C0' },
    { key: 'medicine', emoji: '💊', label: 'Medicine', color: '#C62828' },
    { key: 'shelter', emoji: '🏠', label: 'Shelter', color: '#4527A0' },
    { key: 'rescue', emoji: '🚁', label: 'Rescue', color: '#B71C1C' },
    { key: 'medical_help', emoji: '🩺', label: 'Medical Help', color: '#1B5E20' },
];

type ParamList = {
    NeedsReport: {
        userId: string;
        userName: string;
        location?: { latitude: number; longitude: number; address?: string } | null;
    };
};
type Props = NativeStackScreenProps<ParamList, 'NeedsReport'>;

const NeedsReportScreen: React.FC<Props> = ({ navigation, route }) => {
    const { userId, userName, location } = route.params;

    const [selectedNeeds, setSelectedNeeds] = useState<NeedCategory[]>([]);
    const [peopleCount, setPeopleCount] = useState('1');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const toggleNeed = (key: NeedCategory) => {
        setSelectedNeeds(prev =>
            prev.includes(key) ? prev.filter(n => n !== key) : [...prev, key]
        );
    };

    const submit = async () => {
        if (selectedNeeds.length === 0) {
            Alert.alert('Select Needs', 'Please select at least one item you need.');
            return;
        }
        setSubmitting(true);
        try {
            await sosService.reportNeeds(
                userId,
                userName,
                {
                    latitude: location?.latitude ?? 0,
                    longitude: location?.longitude ?? 0,
                    address: location?.address,
                },
                selectedNeeds,
                parseInt(peopleCount) || 1,
                notes.trim() || undefined
            );
            setSubmitted(true);
            // Try sync immediately
            await sosService.flushSyncQueue();
        } catch {
            Alert.alert('Error', 'Could not save. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <View style={styles.successWrap}>
                    <Animated.View entering={FadeInDown.duration(600)} style={styles.successCard}>
                        <Text style={styles.successEmoji}>✅</Text>
                        <Text style={styles.successTitle}>Report Submitted</Text>
                        <Text style={styles.successSub}>
                            Your needs have been saved offline and will automatically sync to the government coordination centre when internet is available through any nearby device.
                        </Text>
                        <View style={styles.successNeeds}>
                            {selectedNeeds.map(n => {
                                const item = NEEDS.find(x => x.key === n)!;
                                return (
                                    <View key={n} style={[styles.successNeedBadge, { backgroundColor: item.color + '18' }]}>
                                        <Text style={styles.successNeedText}>{item.emoji} {item.label}</Text>
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
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <BackIcon />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>I Need Help</Text>
                    <Text style={styles.headerSub}>Report to relief coordination</Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                {/* Location info */}
                <Animated.View entering={FadeInDown.duration(400)} style={styles.locationBanner}>
                    <Text style={styles.locationBannerText}>
                        📍 {location?.address ?? (location
                            ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                            : 'Location not available')}
                    </Text>
                </Animated.View>

                {/* What do you need? */}
                <Animated.View entering={FadeInUp.duration(400).delay(80)} style={styles.section}>
                    <Text style={styles.sectionTitle}>WHAT DO YOU NEED?</Text>
                    <Text style={styles.sectionSub}>Select all that apply</Text>
                    <View style={styles.needsGrid}>
                        {NEEDS.map((item, i) => {
                            const selected = selectedNeeds.includes(item.key);
                            return (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[
                                        styles.needCard,
                                        { borderColor: selected ? item.color : C.border },
                                        selected && { backgroundColor: item.color + '14' },
                                    ]}
                                    onPress={() => toggleNeed(item.key)}
                                    activeOpacity={0.78}
                                >
                                    <Text style={styles.needEmoji}>{item.emoji}</Text>
                                    <Text style={[styles.needLabel, { color: selected ? item.color : C.brown }]}>
                                        {item.label}
                                    </Text>
                                    {selected && <View style={[styles.selectedDot, { backgroundColor: item.color }]} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>

                {/* People count */}
                <Animated.View entering={FadeInUp.duration(400).delay(140)} style={styles.section}>
                    <Text style={styles.sectionTitle}>HOW MANY PEOPLE?</Text>
                    <View style={styles.countRow}>
                        {['1', '2', '3', '5', '10', '20+'].map(n => (
                            <TouchableOpacity
                                key={n}
                                style={[styles.countBtn, peopleCount === n && styles.countBtnActive]}
                                onPress={() => setPeopleCount(n)}
                                activeOpacity={0.78}
                            >
                                <Text style={[styles.countBtnText, peopleCount === n && styles.countBtnTextActive]}>{n}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>

                {/* Notes */}
                <Animated.View entering={FadeInUp.duration(400).delay(200)} style={styles.section}>
                    <Text style={styles.sectionTitle}>ADDITIONAL DETAILS (OPTIONAL)</Text>
                    <TextInput
                        style={styles.notesInput}
                        placeholder="e.g. Trapped on 3rd floor, elderly person with us, need insulin..."
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
                        📵 Works offline — syncs to government dashboard via mesh gateway
                    </Text>
                </View>

                {/* Submit */}
                <TouchableOpacity
                    style={[styles.submitBtn, selectedNeeds.length === 0 && styles.submitBtnDisabled]}
                    onPress={submit}
                    activeOpacity={0.85}
                    disabled={submitting || selectedNeeds.length === 0}
                >
                    <Text style={styles.submitBtnText}>
                        {submitting ? 'Submitting...' : '📢 Report My Needs'}
                    </Text>
                </TouchableOpacity>

            </ScrollView>
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
    scroll: { padding: 16, paddingBottom: 40 },

    locationBanner: {
        backgroundColor: 'rgba(21,101,192,0.10)', borderRadius: 12,
        padding: 12, marginBottom: 20,
    },
    locationBannerText: { fontSize: 12, fontWeight: '600', color: '#1565C0', lineHeight: 18 },

    section: { marginBottom: 22 },
    sectionTitle: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1, marginBottom: 4 },
    sectionSub: { fontSize: 12, color: C.muted, marginBottom: 12 },

    needsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    needCard: {
        width: '30%', aspectRatio: 1,
        borderWidth: 1.5, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.card, gap: 6, position: 'relative',
    },
    needEmoji: { fontSize: 28 },
    needLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
    selectedDot: {
        position: 'absolute', top: 8, right: 8,
        width: 8, height: 8, borderRadius: 4,
    },

    countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    countBtn: {
        paddingVertical: 10, paddingHorizontal: 18,
        borderWidth: 1.5, borderColor: C.border,
        borderRadius: 50, backgroundColor: C.card,
    },
    countBtnActive: { backgroundColor: C.red, borderColor: C.red },
    countBtnText: { fontSize: 14, fontWeight: '600', color: C.brown },
    countBtnTextActive: { color: C.white },

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
        backgroundColor: C.red, borderRadius: 50,
        paddingVertical: 16, alignItems: 'center',
        shadowColor: C.red, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    },
    submitBtnDisabled: { backgroundColor: 'rgba(44,26,14,0.15)', shadowOpacity: 0, elevation: 0 },
    submitBtnText: { fontSize: 16, fontWeight: '800', color: C.white },

    // Success state
    successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    successCard: {
        backgroundColor: C.white, borderRadius: 24, padding: 28,
        alignItems: 'center', shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 8,
    },
    successEmoji: { fontSize: 64, marginBottom: 16 },
    successTitle: { fontSize: 22, fontWeight: '900', color: C.brown, marginBottom: 10 },
    successSub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    successNeeds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24 },
    successNeedBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    successNeedText: { fontSize: 13, fontWeight: '700', color: C.brown },
    doneBtn: {
        backgroundColor: C.green, borderRadius: 50,
        paddingVertical: 14, paddingHorizontal: 28,
    },
    doneBtnText: { fontSize: 15, fontWeight: '700', color: C.white },
});

export default NeedsReportScreen;
