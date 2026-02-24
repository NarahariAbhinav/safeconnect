/**
 * ContactsManagerScreen — Pick & manage trusted emergency contacts
 *
 * Flow:
 *  1. Opens showing your saved "Trusted Contacts"
 *  2. Tap "+ Add" → search bar appears + device contacts list loads
 *  3. Tap a device contact → type relationship → save
 *  4. Long-press trusted contact → delete / edit relationship
 *  5. Changes persist instantly to AsyncStorage
 *  6. HomeScreen reads trusted contacts from the same storage
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
    FadeInDown,
    FadeInUp,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import {
    DeviceContact,
    TrustedContact,
    contactsService,
} from '../services/contacts';

// ─── Design Tokens ───────────────────────────────────────────────────
const C = {
    bg: '#EBF4F7',
    orange: '#E05A2B',
    orangeLight: 'rgba(224,90,43,0.10)',
    brown: '#2C1A0E',
    brownMid: '#5C3D25',
    muted: '#8C7060',
    white: '#FFFFFF',
    card: 'rgba(255,255,255,0.92)',
    border: 'rgba(44,26,14,0.08)',
    green: '#2A7A5A',
    greenLight: 'rgba(42,122,90,0.10)',
    red: '#D32F2F',
    redLight: 'rgba(211,47,47,0.10)',
    blue: '#1565C0',
    blueLight: 'rgba(21,101,192,0.10)',
};

const RELATIONSHIPS = [
    'Father', 'Mother', 'Brother', 'Sister', 'Spouse',
    'Friend', 'Colleague', 'Doctor', 'Neighbour', 'Other',
];

// ─── SVG Icons ────────────────────────────────────────────────────────
const BackIcon = () => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M12 19l-7-7 7-7" stroke={C.brown} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const AddIcon = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke={C.white} strokeWidth="1.8" />
        <Path d="M12 8v8M8 12h8" stroke={C.white} strokeWidth="2" strokeLinecap="round" />
    </Svg>
);
const SearchIcon = () => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Circle cx="11" cy="11" r="7" stroke={C.muted} strokeWidth="2" />
        <Line x1="16.5" y1="16.5" x2="21" y2="21" stroke={C.muted} strokeWidth="2" strokeLinecap="round" />
    </Svg>
);
const TrashIcon = () => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={C.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const EditIcon = () => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const PhoneIcon = () => (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <Path d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" stroke={C.muted} strokeWidth="1.5" fill="none" />
    </Svg>
);

// ─── Avatar Component ─────────────────────────────────────────────────
const Avatar: React.FC<{ name: string; color?: string; size?: number; selected?: boolean }> = ({
    name, color = C.orange, size = 44, selected = false,
}) => {
    const initials = contactsService.getInitials(name);
    return (
        <View style={[
            avatarStyles.wrap,
            { width: size, height: size, borderRadius: size * 0.32, backgroundColor: selected ? C.orange : color + '22' },
            selected && avatarStyles.selected,
        ]}>
            <Text style={[avatarStyles.text, { fontSize: size * 0.36, color: selected ? C.white : color }]}>
                {initials}
            </Text>
        </View>
    );
};

const avatarStyles = StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    selected: { backgroundColor: C.orange },
    text: { fontWeight: '800' },
});

// ─── Relationship Picker Modal ─────────────────────────────────────────
interface RelPickerProps {
    visible: boolean;
    contactName: string;
    initial?: string;
    onConfirm: (rel: string) => void;
    onCancel: () => void;
}
const RelationshipPicker: React.FC<RelPickerProps> = ({ visible, contactName, initial = '', onConfirm, onCancel }) => {
    const [selected, setSelected] = useState(initial);
    const [custom, setCustom] = useState('');

    useEffect(() => { setSelected(initial); }, [initial, visible]);

    const confirm = () => {
        const rel = selected === 'Other' ? custom.trim() || 'Other' : selected;
        if (!rel) { Alert.alert('Please select a relationship'); return; }
        onConfirm(rel);
    };

    return (
        <Modal transparent visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <View style={rpStyles.overlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onCancel} activeOpacity={1} />
                    <View style={rpStyles.sheet}>
                        <View style={rpStyles.handle} />
                        <Text style={rpStyles.title}>Add "{contactName}"</Text>
                        <Text style={rpStyles.subtitle}>What is your relationship with this person?</Text>

                        <View style={rpStyles.grid}>
                            {RELATIONSHIPS.map(rel => (
                                <TouchableOpacity
                                    key={rel}
                                    style={[rpStyles.chip, selected === rel && rpStyles.chipActive]}
                                    onPress={() => setSelected(rel)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[rpStyles.chipText, selected === rel && rpStyles.chipTextActive]}>
                                        {rel}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {selected === 'Other' && (
                            <TextInput
                                style={rpStyles.customInput}
                                placeholder="Type relationship..."
                                placeholderTextColor={C.muted}
                                value={custom}
                                onChangeText={setCustom}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={confirm}
                            />
                        )}

                        <TouchableOpacity style={rpStyles.confirmBtn} onPress={confirm} activeOpacity={0.82}>
                            <Text style={rpStyles.confirmText}>Add to Trusted Contacts</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={rpStyles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
                            <Text style={rpStyles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const rpStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(44,26,14,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(44,26,14,0.15)', alignSelf: 'center', marginBottom: 20 },
    title: { fontSize: 18, fontWeight: '800', color: C.brown, letterSpacing: -0.5, marginBottom: 4 },
    subtitle: { fontSize: 12, fontWeight: '500', color: C.muted, marginBottom: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: { borderWidth: 1.5, borderColor: C.border, borderRadius: 100, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: C.bg },
    chipActive: { backgroundColor: C.orange, borderColor: C.orange },
    chipText: { fontSize: 13, fontWeight: '600', color: C.brownMid },
    chipTextActive: { color: C.white },
    customInput: { borderWidth: 1.5, borderColor: C.orange, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.brown, marginBottom: 16 },
    confirmBtn: { backgroundColor: C.orange, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginBottom: 10, shadowColor: C.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 5 },
    confirmText: { fontSize: 15, fontWeight: '700', color: C.white },
    cancelBtn: { alignItems: 'center', paddingVertical: 8 },
    cancelText: { fontSize: 13, fontWeight: '600', color: C.muted },
});

// ─── Main Screen ──────────────────────────────────────────────────────
interface Props { navigation: any; }

const ContactsManagerScreen: React.FC<Props> = ({ navigation }) => {
    const [trustedContacts, setTrustedContacts] = useState<TrustedContact[]>([]);
    const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [loadingDeviceContacts, setLoadingDeviceContacts] = useState(false);
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [relPickerContact, setRelPickerContact] = useState<DeviceContact | null>(null);
    const [editingContact, setEditingContact] = useState<TrustedContact | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);

    const searchRef = useRef<TextInput>(null);
    const panelHeight = useSharedValue(0);

    // ── Load trusted contacts on mount ──
    useEffect(() => {
        contactsService.getTrusted().then(setTrustedContacts);
    }, []);

    // ── Load device contacts when add panel opens ──
    const openAddPanel = useCallback(async () => {
        setShowAddPanel(true);
        setLoadingDeviceContacts(true);
        panelHeight.value = withSpring(1, { damping: 18, stiffness: 120 });
        setTimeout(() => searchRef.current?.focus(), 300);

        const granted = await contactsService.requestPermission();
        if (!granted) {
            setPermissionDenied(true);
            setLoadingDeviceContacts(false);
            return;
        }
        const contacts = await contactsService.fetchAll();
        setDeviceContacts(contacts);
        setLoadingDeviceContacts(false);
    }, []);

    // ── Search filter ──
    useEffect(() => {
        if (!showAddPanel) return;
        const t = setTimeout(async () => {
            setIsSearching(true);
            const results = await contactsService.fetchAll(searchQuery);
            setDeviceContacts(results);
            setIsSearching(false);
        }, 300);
        return () => clearTimeout(t);
    }, [searchQuery, showAddPanel]);

    // ── Add contact ──
    const handleAddContact = async (rel: string) => {
        if (!relPickerContact) return;
        const updated = await contactsService.addTrusted(relPickerContact, rel);
        setTrustedContacts(updated);
        setRelPickerContact(null);
    };

    // ── Edit relationship ──
    const handleEditRelationship = async (rel: string) => {
        if (!editingContact) return;
        const updated = await contactsService.updateRelationship(editingContact.id, rel);
        setTrustedContacts(updated);
        setEditingContact(null);
    };

    // ── Remove contact ──
    const confirmRemove = (contact: TrustedContact) => {
        Alert.alert(
            'Remove Contact',
            `Remove ${contact.name} from your trusted contacts?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        const updated = await contactsService.removeTrusted(contact.id);
                        setTrustedContacts(updated);
                    },
                },
            ]
        );
    };

    // ── Already-trusted set (for quick lookup) ──
    const trustedIds = new Set(trustedContacts.map(c => c.id));

    // ── Animated panel style (unused now, kept for future) ──
    const addPanelStyle = useAnimatedStyle(() => ({
        opacity: withTiming(showAddPanel ? 1 : 0, { duration: 200 }),
    }));

    // ── Render trusted contact row ──
    const renderTrustedContact = ({ item, index }: { item: TrustedContact; index: number }) => (
        <Animated.View entering={FadeInDown.duration(300).delay(index * 60)}>
            <TouchableOpacity
                style={styles.trustedRow}
                activeOpacity={0.82}
                onPress={() => navigation.navigate('ContactDetail', { contactId: item.id })}
            >
                <Avatar name={item.name} color={item.avatarColor || C.orange} size={48} />
                <View style={styles.trustedInfo}>
                    <Text style={styles.trustedName}>{item.name}</Text>
                    <View style={styles.trustedMeta}>
                        <Text style={styles.trustedRel}>{item.relationship}</Text>
                        <Text style={styles.trustedPhone}>
                            <PhoneIcon />  {item.phone}
                        </Text>
                    </View>
                    <Text style={styles.tapHint}>Tap to message, share location & files →</Text>
                </View>
                <View style={styles.trustedActions}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: C.blueLight }]}
                        onPress={(e) => { e.stopPropagation?.(); setEditingContact(item); }}
                        activeOpacity={0.75}
                    >
                        <EditIcon />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: C.redLight }]}
                        onPress={(e) => { e.stopPropagation?.(); confirmRemove(item); }}
                        activeOpacity={0.75}
                    >
                        <TrashIcon />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );

    // ── Render device contact row ──
    const renderDeviceContact = ({ item }: { item: DeviceContact }) => {
        const alreadyAdded = trustedIds.has(item.id);
        return (
            <TouchableOpacity
                style={[styles.deviceRow, alreadyAdded && styles.deviceRowAdded]}
                onPress={() => !alreadyAdded && setRelPickerContact(item)}
                activeOpacity={alreadyAdded ? 1 : 0.75}
            >
                <Avatar name={item.name} color={C.brownMid} size={42} />
                <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{item.name}</Text>
                    <Text style={styles.devicePhone}>{item.phone}</Text>
                </View>
                {alreadyAdded ? (
                    <View style={styles.addedBadge}>
                        <Text style={styles.addedBadgeText}>✓ Added</Text>
                    </View>
                ) : (
                    <View style={styles.addDeviceBtn}>
                        <Text style={styles.addDeviceBtnText}>+ Add</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* ── Relationship Picker (for new contact) ── */}
            <RelationshipPicker
                visible={!!relPickerContact}
                contactName={relPickerContact?.name ?? ''}
                onConfirm={handleAddContact}
                onCancel={() => setRelPickerContact(null)}
            />

            {/* ── Edit Relationship (for existing trusted contact) ── */}
            <RelationshipPicker
                visible={!!editingContact}
                contactName={editingContact?.name ?? ''}
                initial={editingContact?.relationship}
                onConfirm={handleEditRelationship}
                onCancel={() => setEditingContact(null)}
            />

            {/* ── Header ── */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <BackIcon />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Trusted Contacts</Text>
                    <Text style={styles.headerSub}>{trustedContacts.length} contact{trustedContacts.length !== 1 ? 's' : ''} saved</Text>
                </View>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={showAddPanel ? () => { setShowAddPanel(false); Keyboard.dismiss(); } : openAddPanel}
                    activeOpacity={0.82}
                >
                    <View style={{ transform: [{ rotate: showAddPanel ? '45deg' : '0deg' }] }}>
                        <AddIcon />
                    </View>
                </TouchableOpacity>
            </Animated.View>

            {/* ── Add Contact Search Panel ── */}
            {showAddPanel && (
                <Animated.View entering={FadeInUp.duration(300)} exiting={FadeOut.duration(200)} style={styles.searchPanel}>
                    <View style={styles.searchBar}>
                        <SearchIcon />
                        <TextInput
                            ref={searchRef}
                            style={styles.searchInput}
                            placeholder="Search device contacts..."
                            placeholderTextColor={C.muted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            returnKeyType="search"
                            clearButtonMode="while-editing"
                        />
                        {isSearching && <ActivityIndicator size="small" color={C.orange} />}
                    </View>

                    {permissionDenied ? (
                        <View style={styles.permDenied}>
                            <Text style={styles.permDeniedText}>
                                📵 Contacts permission denied.{'\n'}Go to Settings → SafeConnect → Contacts → Allow.
                            </Text>
                            <TouchableOpacity style={styles.openSettingsBtn} activeOpacity={0.8}>
                                <Text style={styles.openSettingsBtnText}>Open Settings</Text>
                            </TouchableOpacity>
                        </View>
                    ) : loadingDeviceContacts ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator size="large" color={C.orange} />
                            <Text style={styles.loadingText}>Loading contacts...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={deviceContacts}
                            keyExtractor={item => item.id}
                            renderItem={renderDeviceContact}
                            style={styles.deviceList}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>
                                    {searchQuery ? 'No contacts found.' : 'No contacts on device.'}
                                </Text>
                            }
                        />
                    )}
                </Animated.View>
            )}

            {/* ── Trusted Contacts List ── */}
            {!showAddPanel && (
                <Animated.View entering={FadeInUp.duration(400)} style={styles.trustedSection}>
                    {trustedContacts.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>👥</Text>
                            <Text style={styles.emptyTitle}>No Trusted Contacts Yet</Text>
                            <Text style={styles.emptyDesc}>
                                Add people from your contacts who should receive your location during emergencies.
                            </Text>
                            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddPanel} activeOpacity={0.82}>
                                <Text style={styles.emptyAddBtnText}>+ Add Your First Contact</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <FlatList
                            data={trustedContacts}
                            keyExtractor={item => item.id}
                            renderItem={renderTrustedContact}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContent}
                            ListHeaderComponent={
                                <Text style={styles.sectionLabel}>YOUR TRUSTED PEOPLE</Text>
                            }
                        />
                    )}
                </Animated.View>
            )}
        </SafeAreaView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: C.brown, letterSpacing: -0.5 },
    headerSub: { fontSize: 11, fontWeight: '500', color: C.muted, marginTop: 1 },
    addBtn: {
        width: 42, height: 42, borderRadius: 13,
        backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center',
        shadowColor: C.orange, shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
    },

    // Search panel
    searchPanel: {
        flex: 1, paddingHorizontal: 18,
    },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border,
        borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
        marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 14, color: C.brown },
    deviceList: { flex: 1 },
    deviceRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
        borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11,
        marginBottom: 8,
    },
    deviceRowAdded: { opacity: 0.6 },
    deviceInfo: { flex: 1 },
    deviceName: { fontSize: 14, fontWeight: '700', color: C.brown, letterSpacing: -0.2 },
    devicePhone: { fontSize: 11, fontWeight: '500', color: C.muted, marginTop: 1 },
    addDeviceBtn: {
        backgroundColor: C.orangeLight, borderWidth: 1.5,
        borderColor: C.orange, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 6,
    },
    addDeviceBtnText: { fontSize: 12, fontWeight: '700', color: C.orange },
    addedBadge: {
        backgroundColor: C.greenLight, borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 6,
    },
    addedBadgeText: { fontSize: 12, fontWeight: '700', color: C.green },

    // Trusted list
    trustedSection: { flex: 1, paddingHorizontal: 18 },
    listContent: { paddingBottom: 40 },
    sectionLabel: {
        fontSize: 10, fontWeight: '700', color: C.muted,
        letterSpacing: 1.2, marginBottom: 12, marginTop: 4,
    },
    trustedRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
        borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
        marginBottom: 10,
        shadowColor: C.brown, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },
    trustedInfo: { flex: 1 },
    trustedName: { fontSize: 15, fontWeight: '800', color: C.brown, letterSpacing: -0.3 },
    trustedMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
    trustedRel: {
        fontSize: 11, fontWeight: '700', color: C.white,
        backgroundColor: C.orange, borderRadius: 6,
        paddingHorizontal: 7, paddingVertical: 2,
    },
    trustedPhone: { fontSize: 11, fontWeight: '500', color: C.muted },
    tapHint: { fontSize: 10, fontWeight: '500', color: C.orange, marginTop: 4, letterSpacing: -0.1 },
    trustedActions: { flexDirection: 'row', gap: 8 },
    actionBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

    // Loading & empty
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 13, color: C.muted, fontWeight: '500' },
    emptyText: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 40, fontWeight: '500' },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 56, marginBottom: 16 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: C.brown, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
    emptyDesc: { fontSize: 13, fontWeight: '500', color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
    emptyAddBtn: {
        backgroundColor: C.orange, borderRadius: 100,
        paddingVertical: 14, paddingHorizontal: 28,
        shadowColor: C.orange, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28, shadowRadius: 10, elevation: 5,
    },
    emptyAddBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

    // Permission denied
    permDenied: { alignItems: 'center', padding: 24 },
    permDeniedText: { fontSize: 13, color: C.brownMid, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
    openSettingsBtn: {
        backgroundColor: C.orange, borderRadius: 100,
        paddingVertical: 12, paddingHorizontal: 24,
    },
    openSettingsBtnText: { fontSize: 14, fontWeight: '700', color: C.white },
});

export default ContactsManagerScreen;
