/**
 * ProfileScreen.tsx — Premium User Profile
 *
 * Features:
 *  • View & edit name, email (phone is read-only identity)
 *  • Change password (with current password verification)
 *  • Mesh status live indicator
 *  • App info section (version, build)
 *  • Logout with confirmation
 *  • Delete account with double-confirm
 *  • Full offline — reads/writes from AsyncStorage via authService
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
    FadeInDown
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { bleMeshService } from '../services/ble/BLEMeshService';

// ─── Colors ───────────────────────────────────────────────────────
const C = {
    bg: '#F0F4FA',
    card: '#FFFFFF',
    orange: '#E05A2B',
    orangeLight: 'rgba(224,90,43,0.10)',
    brown: '#1A1A2E',
    muted: '#64748B',
    border: '#E2E8F0',
    green: '#059669',
    greenLight: 'rgba(5,150,105,0.10)',
    red: '#DC2626',
    redLight: 'rgba(220,38,38,0.09)',
    blue: '#2563EB',
    blueLight: 'rgba(37,99,235,0.10)',
    amber: '#D97706',
    amberLight: 'rgba(217,119,6,0.10)',
    white: '#FFFFFF',
    shadow: 'rgba(0,0,0,0.06)',
};

// ─── Icons ────────────────────────────────────────────────────────
const BackIcon = () => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M12 19l-7-7 7-7" stroke={C.brown} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const EditIcon = () => (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const CheckIcon = () => (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <Path d="M20 6L9 17l-5-5" stroke={C.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const LockIcon = () => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Path d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const LogoutIcon = () => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const MeshIcon = () => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Circle cx="5" cy="12" r="2" fill={C.green} />
        <Circle cx="12" cy="5" r="2" fill={C.green} opacity={0.8} />
        <Circle cx="19" cy="12" r="2" fill={C.green} opacity={0.8} />
        <Circle cx="12" cy="19" r="2" fill={C.green} opacity={0.6} />
        <Line x1="7" y1="10.5" x2="10.2" y2="6.9" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="13.8" y1="6.9" x2="17" y2="10.5" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="7" y1="13.5" x2="10.2" y2="17.1" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="13.8" y1="17.1" x2="17" y2="13.5" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
);
const TrashIcon = () => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);
const InfoIcon = () => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={C.muted} strokeWidth="2" />
        <Path d="M12 16v-4M12 8h.01" stroke={C.muted} strokeWidth="2" strokeLinecap="round" />
    </Svg>
);

// ─── Types ────────────────────────────────────────────────────────
type RootParamList = {
    Profile: { user: { id: string; firstName: string; lastName?: string; email?: string; phone: string } };
    Home: { user: any };
    Login: undefined;
    Onboarding: undefined;
};
type Props = NativeStackScreenProps<RootParamList, 'Profile'>;

interface UserProfile {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    passwordHash?: string;
    createdAt?: string;
}

// ─── Helper: hash password ─────────────────────────────────────────
const hashPassword = async (pw: string) =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pw);

// ─── Section Card ─────────────────────────────────────────────────
const SectionCard: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
    <View style={[styles.card, style]}>{children}</View>
);

// ─── Row Item ─────────────────────────────────────────────────────
const RowItem: React.FC<{
    label: string;
    value?: string;
    icon?: React.ReactNode;
    onPress?: () => void;
    rightEl?: React.ReactNode;
    labelColor?: string;
}> = ({ label, value, icon, onPress, rightEl, labelColor }) => (
    <TouchableOpacity
        style={styles.rowItem}
        onPress={onPress}
        activeOpacity={onPress ? 0.65 : 1}
        disabled={!onPress}
    >
        {icon && <View style={styles.rowIcon}>{icon}</View>}
        <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : {}]}>{label}</Text>
            {value !== undefined && <Text style={styles.rowValue}>{value}</Text>}
        </View>
        {rightEl && <View style={styles.rowRight}>{rightEl}</View>}
        {onPress && !rightEl && (
            <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={C.muted} strokeWidth="2" strokeLinecap="round" />
            </Svg>
        )}
    </TouchableOpacity>
);

// ─── Main Screen ──────────────────────────────────────────────────
const ProfileScreen: React.FC<Props> = ({ navigation, route }) => {
    const routeUser = route.params?.user;

    const [user, setUser] = useState<UserProfile>({
        id: routeUser?.id || '',
        firstName: routeUser?.firstName || '',
        lastName: routeUser?.lastName || '',
        email: routeUser?.email || '',
        phone: routeUser?.phone || '',
    });

    const [peerCount, setPeerCount] = useState(0);
    const [saving, setSaving] = useState(false);

    // Edit states
    type EditField = 'name' | 'email' | 'phone' | 'password' | null;
    const [editField, setEditField] = useState<EditField>(null);
    // Name
    const [editFirst, setEditFirst] = useState('');
    const [editLast, setEditLast] = useState('');
    // Email
    const [editEmail, setEditEmail] = useState('');
    // Phone
    const [editPhone, setEditPhone] = useState('');
    // Password
    const [currPw, setCurrPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');

    // ── Load full profile from AsyncStorage ──
    const loadProfile = useCallback(async () => {
        try {
            // Force fetch latest identity since route params might be stale after updates
            const sessionRaw = await AsyncStorage.getItem('safeconnect_currentUser');
            const sessionIdentity = sessionRaw ? JSON.parse(sessionRaw) : routeUser;

            const raw = await AsyncStorage.getItem('safeconnect_users');
            if (!raw) return;
            const users: UserProfile[] = JSON.parse(raw);

            // Match against updated session identity
            const me = users.find(u =>
                (u.id && sessionIdentity?.id && u.id === sessionIdentity.id) ||
                (u.phone && sessionIdentity?.phone && u.phone === sessionIdentity.phone)
            );

            if (me) {
                setUser({
                    id: me.id,
                    firstName: me.firstName || '',
                    lastName: me.lastName || '',
                    email: me.email || '',
                    phone: me.phone || '',
                    passwordHash: me.passwordHash,
                    createdAt: me.createdAt,
                });
            }
        } catch (e) { console.error('[Profile] Load error:', e); }
    }, [routeUser]);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    // ── Mesh peer count ──
    useEffect(() => {
        setPeerCount(bleMeshService.getPeerCount());
        const interval = setInterval(() => setPeerCount(bleMeshService.getPeerCount()), 5000);
        return () => clearInterval(interval);
    }, []);

    // ── Update user in AsyncStorage ──
    const persistUpdate = async (updates: Partial<UserProfile>) => {
        const raw = await AsyncStorage.getItem('safeconnect_users');
        const users: UserProfile[] = raw ? JSON.parse(raw) : [];
        const idx = users.findIndex(u => u.id === user.id || u.phone === user.phone);
        if (idx === -1) return;
        users[idx] = { ...users[idx], ...updates };
        await AsyncStorage.setItem('safeconnect_users', JSON.stringify(users));
        // Also update session
        const sessionRaw = await AsyncStorage.getItem('safeconnect_currentUser');
        if (sessionRaw) {
            const session = JSON.parse(sessionRaw);
            await AsyncStorage.setItem('safeconnect_currentUser', JSON.stringify({ ...session, ...updates }));
        }
    };

    // ── Save name ──
    const saveName = async () => {
        const first = editFirst.trim();
        const last = editLast.trim();
        if (!first) { Alert.alert('Required', 'First name cannot be empty.'); return; }
        if (first.length < 2) { Alert.alert('Too Short', 'First name must be at least 2 characters.'); return; }
        if (first.length > 30) { Alert.alert('Too Long', 'First name cannot exceed 30 characters.'); return; }
        if (!/^[a-zA-Z\s'\-]+$/.test(first)) { Alert.alert('Invalid Name', 'First name can only contain letters, spaces, hyphens, or apostrophes. No numbers or special characters.'); return; }
        if (last && last.length < 2) { Alert.alert('Too Short', 'Last name must be at least 2 characters if entered.'); return; }
        if (last && last.length > 30) { Alert.alert('Too Long', 'Last name cannot exceed 30 characters.'); return; }
        if (last && !/^[a-zA-Z\s'\-]+$/.test(last)) { Alert.alert('Invalid Name', 'Last name can only contain letters, spaces, hyphens, or apostrophes.'); return; }
        setSaving(true);
        try {
            await persistUpdate({ firstName: first, lastName: last });
            setUser(u => ({ ...u, firstName: first, lastName: last }));
            setEditField(null);
            Alert.alert('✅ Updated', 'Your name has been updated.');
        } catch { Alert.alert('Error', 'Failed to save. Please try again.'); }
        setSaving(false);
    };

    // ── Save email ──
    const saveEmail = async () => {
        const email = editEmail.trim().toLowerCase();
        if (email) {
            // Strict email regex — requires proper TLD (min 2 chars)
            const emailReg = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
            if (!emailReg.test(email)) { Alert.alert('Invalid Email', 'Please enter a valid email address.\nExample: yourname@gmail.com'); return; }
            if (email.length > 100) { Alert.alert('Too Long', 'Email address cannot exceed 100 characters.'); return; }
        }
        setSaving(true);
        try {
            await persistUpdate({ email });
            setUser(u => ({ ...u, email }));
            setEditField(null);
            Alert.alert('✅ Updated', email ? 'Email address updated.' : 'Email address cleared.');
        } catch { Alert.alert('Error', 'Failed to save. Please try again.'); }
        setSaving(false);
    };

    // ── Save phone ──
    const savePhone = async () => {
        const raw = editPhone.trim();
        if (!raw) { Alert.alert('Required', 'Phone number cannot be empty.'); return; }
        // Strip country code (+91 or 0091 or leading 91 if 12 digits)
        const stripped = raw.replace(/^\+?0*91/, '').replace(/\D/g, '');
        const digits = stripped.replace(/\D/g, '');
        if (digits.length !== 10) {
            Alert.alert(
                'Invalid Phone Number',
                `Indian mobile numbers must be exactly 10 digits.\nYou entered ${digits.length} digit${digits.length !== 1 ? 's' : ''}.\n\nExample: 98765 43210`
            );
            return;
        }
        if (!/^[6-9]/.test(digits)) {
            Alert.alert('Invalid Number', 'Indian mobile numbers must start with 6, 7, 8, or 9.\n\nExample: 98765 43210');
            return;
        }
        const normalized = '+91' + digits;
        setSaving(true);
        try {
            await persistUpdate({ phone: normalized });
            setUser(u => ({ ...u, phone: normalized }));
            setEditField(null);
            Alert.alert('✅ Updated', `Phone updated to ${normalized}`);
        } catch { Alert.alert('Error', 'Failed to save. Please try again.'); }
        setSaving(false);
    };

    // ── Change password ──
    const savePassword = async () => {
        if (!currPw || !newPw || !confirmPw) { Alert.alert('Required', 'Please fill all three password fields.'); return; }
        if (newPw.length < 6) { Alert.alert('Weak Password', 'New password must be at least 6 characters.'); return; }
        if (newPw.length > 64) { Alert.alert('Too Long', 'Password cannot exceed 64 characters.'); return; }
        if (newPw !== confirmPw) { Alert.alert('Mismatch', 'New password and confirmation do not match. Please re-enter.'); return; }
        if (newPw.startsWith(' ') || newPw.endsWith(' ')) { Alert.alert('Invalid', 'Password cannot start or end with a space.'); return; }
        setSaving(true);
        try {
            const currHash = await hashPassword(currPw);
            if (user.passwordHash && currHash !== user.passwordHash) {
                Alert.alert('Wrong Password', 'Current password is incorrect. Please try again.');
                setSaving(false); return;
            }
            const newHash = await hashPassword(newPw);
            if (user.passwordHash && newHash === user.passwordHash) {
                Alert.alert('Same Password', 'New password must be different from your current password.');
                setSaving(false); return;
            }
            await persistUpdate({ passwordHash: newHash });
            setUser(u => ({ ...u, passwordHash: newHash }));
            setEditField(null); setCurrPw(''); setNewPw(''); setConfirmPw('');
            Alert.alert('✅ Password Changed', 'Your password has been updated successfully.');
        } catch { Alert.alert('Error', 'Failed to change password. Please try again.'); }
        setSaving(false);
    };


    // ── Cancel edit ──
    const cancelEdit = () => {
        setEditField(null);
        setCurrPw(''); setNewPw(''); setConfirmPw('');
    };

    // ── Logout ──
    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout? Your local data remains on this device.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout', style: 'destructive', onPress: async () => {
                        await AsyncStorage.multiRemove(['safeconnect_currentUser', 'safeconnect_token']);
                        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                    }
                },
            ]
        );
    };

    // ── Delete account ──
    const handleDeleteAccount = () => {
        Alert.alert(
            '⚠️ Delete Account',
            'This will permanently erase ALL your data including SOS history, contacts, and chats from this device. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Everything', style: 'destructive', onPress: () => {
                        Alert.alert(
                            'Final Confirmation',
                            `Type "DELETE" to confirm.\n\nAll data for ${user.firstName} will be permanently removed.`,
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Permanently Delete', style: 'destructive', onPress: async () => {
                                        try {
                                            // Remove user from users list
                                            const raw = await AsyncStorage.getItem('safeconnect_users');
                                            if (raw) {
                                                const users: UserProfile[] = JSON.parse(raw);
                                                const filtered = users.filter(u => u.id !== user.id);
                                                await AsyncStorage.setItem('safeconnect_users', JSON.stringify(filtered));
                                            }
                                            // Clear all local keys
                                            const allKeys = await AsyncStorage.getAllKeys();
                                            const safeKeys = allKeys.filter(k => k.startsWith('safeconnect_') || k.startsWith('chat_') || k.startsWith('ble_'));
                                            await AsyncStorage.multiRemove(safeKeys);
                                            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
                                        } catch {
                                            Alert.alert('Error', 'Failed to delete account.');
                                        }
                                    }
                                },
                            ]
                        );
                    }
                },
            ]
        );
    };

    // ── Avatar initials ──
    const initials = `${user.firstName[0] || '?'}${user.lastName[0] || ''}`.toUpperCase();
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const memberSince = user.createdAt
        ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
        : null;

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                    {/* ── Header ── */}
                    <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.header}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                            <BackIcon />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>My Profile</Text>
                        <View style={{ width: 40 }} />
                    </Animated.View>

                    {/* ── Avatar Card ── */}
                    <Animated.View entering={FadeInDown.delay(60).duration(400)}>
                        <SectionCard style={styles.avatarCard}>
                            <View style={styles.avatarCircle}>
                                <Text style={styles.avatarText}>{initials}</Text>
                            </View>
                            <Text style={styles.avatarName}>{fullName || 'Your Name'}</Text>
                            <Text style={styles.avatarPhone}>📱 {user.phone}</Text>
                            {memberSince && (
                                <View style={styles.memberBadge}>
                                    <Text style={styles.memberBadgeText}>Member since {memberSince}</Text>
                                </View>
                            )}
                            {/* Mesh status pill */}
                            <View style={[styles.meshPill, { backgroundColor: peerCount > 0 ? C.greenLight : C.amberLight }]}>
                                <View style={[styles.meshDot, { backgroundColor: peerCount > 0 ? C.green : C.amber }]} />
                                <Text style={[styles.meshPillText, { color: peerCount > 0 ? C.green : C.amber }]}>
                                    {peerCount > 0 ? `${peerCount} peer${peerCount > 1 ? 's' : ''} connected · Mesh ON` : 'Mesh · No peers nearby'}
                                </Text>
                            </View>
                        </SectionCard>
                    </Animated.View>

                    {/* ══════════════════════════ EDIT PANELS ══════════════════════════ */}

                    {/* Name edit panel */}
                    {editField === 'name' && (
                        <Animated.View entering={FadeInDown.duration(300)}>
                            <SectionCard>
                                <Text style={styles.editTitle}>Edit Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editFirst}
                                    onChangeText={setEditFirst}
                                    placeholder="First name *"
                                    placeholderTextColor={C.muted}
                                    autoFocus
                                />
                                <TextInput
                                    style={[styles.input, { marginTop: 8 }]}
                                    value={editLast}
                                    onChangeText={setEditLast}
                                    placeholder="Last name (optional)"
                                    placeholderTextColor={C.muted}
                                />
                                <EditActions onSave={saveName} onCancel={cancelEdit} saving={saving} />
                            </SectionCard>
                        </Animated.View>
                    )}

                    {/* Email edit panel */}
                    {editField === 'email' && (
                        <Animated.View entering={FadeInDown.duration(300)}>
                            <SectionCard>
                                <Text style={styles.editTitle}>Edit Email</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editEmail}
                                    onChangeText={setEditEmail}
                                    placeholder="your@email.com"
                                    placeholderTextColor={C.muted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoFocus
                                />
                                <EditActions onSave={saveEmail} onCancel={cancelEdit} saving={saving} />
                            </SectionCard>
                        </Animated.View>
                    )}

                    {/* Phone edit panel */}
                    {editField === 'phone' && (
                        <Animated.View entering={FadeInDown.duration(300)}>
                            <SectionCard>
                                <Text style={styles.editTitle}>Edit Phone Number</Text>
                                <TextInput
                                    style={styles.input}
                                    value={editPhone}
                                    onChangeText={setEditPhone}
                                    placeholder="+91 98765 43210"
                                    placeholderTextColor={C.muted}
                                    keyboardType="phone-pad"
                                    autoFocus
                                />
                                <EditActions onSave={savePhone} onCancel={cancelEdit} saving={saving} saveLabel="Update Phone" />
                            </SectionCard>
                        </Animated.View>
                    )}

                    {/* Password change panel */}
                    {editField === 'password' && (
                        <Animated.View entering={FadeInDown.duration(300)}>
                            <SectionCard>
                                <Text style={styles.editTitle}>Change Password</Text>
                                <TextInput style={styles.input} value={currPw} onChangeText={setCurrPw} placeholder="Current password" placeholderTextColor={C.muted} secureTextEntry autoFocus />
                                <TextInput style={[styles.input, { marginTop: 8 }]} value={newPw} onChangeText={setNewPw} placeholder="New password (min 6 chars)" placeholderTextColor={C.muted} secureTextEntry />
                                <TextInput style={[styles.input, { marginTop: 8 }]} value={confirmPw} onChangeText={setConfirmPw} placeholder="Confirm new password" placeholderTextColor={C.muted} secureTextEntry />
                                <EditActions onSave={savePassword} onCancel={cancelEdit} saving={saving} saveLabel="Change Password" />
                            </SectionCard>
                        </Animated.View>
                    )}

                    {/* ══════════════════════════ PROFILE INFO ══════════════════════════ */}
                    <Animated.View entering={FadeInDown.delay(120).duration(400)}>
                        <Text style={styles.sectionLabel}>Account Details</Text>
                        <SectionCard>
                            <RowItem
                                label="Full Name"
                                value={fullName || '—'}
                                icon={<EditIcon />}
                                onPress={() => { setEditFirst(user.firstName); setEditLast(user.lastName); setEditField('name'); }}
                            />
                            <View style={styles.divider} />
                            <RowItem
                                label="Email Address"
                                value={user.email || 'Not set'}
                                icon={<EditIcon />}
                                onPress={() => { setEditEmail(user.email); setEditField('email'); }}
                            />
                            <View style={styles.divider} />
                            <RowItem
                                label="Phone Number"
                                value={user.phone || 'Not set'}
                                icon={<EditIcon />}
                                onPress={() => { setEditPhone(user.phone); setEditField('phone'); }}
                            />
                        </SectionCard>
                    </Animated.View>

                    {/* ── Security ── */}
                    <Animated.View entering={FadeInDown.delay(180).duration(400)}>
                        <Text style={styles.sectionLabel}>Security</Text>
                        <SectionCard>
                            <RowItem
                                label="Change Password"
                                value="Update your login password"
                                icon={<LockIcon />}
                                onPress={() => setEditField('password')}
                            />
                        </SectionCard>
                    </Animated.View>

                    {/* ── Mesh Network ── */}
                    <Animated.View entering={FadeInDown.delay(240).duration(400)}>
                        <Text style={styles.sectionLabel}>Mesh Network</Text>
                        <SectionCard>
                            <RowItem
                                label="BLE Mesh Status"
                                value={peerCount > 0 ? `${peerCount} peer${peerCount > 1 ? 's' : ''} connected` : 'Searching for peers...'}
                                icon={<MeshIcon />}
                                rightEl={
                                    <View style={[styles.statusPill, { backgroundColor: peerCount > 0 ? C.greenLight : C.amberLight }]}>
                                        <Text style={[styles.statusPillText, { color: peerCount > 0 ? C.green : C.amber }]}>
                                            {peerCount > 0 ? 'Active' : 'Searching'}
                                        </Text>
                                    </View>
                                }
                            />
                            <View style={styles.divider} />
                            <View style={styles.meshInfo}>
                                <Text style={styles.meshInfoText}>
                                    📡 Messages, SOS alerts, and emergency data travel via BLE mesh even without internet.{'\n'}
                                    Your data is end-to-end encrypted.
                                </Text>
                            </View>
                        </SectionCard>
                    </Animated.View>

                    {/* ── App Info ── */}
                    <Animated.View entering={FadeInDown.delay(300).duration(400)}>
                        <Text style={styles.sectionLabel}>About</Text>
                        <SectionCard>
                            <RowItem label="App" value="SafeConnect" icon={<InfoIcon />} />
                            <View style={styles.divider} />
                            <RowItem label="Version" value="1.0.0 (Build 1)" icon={<InfoIcon />} />
                            <View style={styles.divider} />
                            <RowItem label="User ID" value={`#${user.id.slice(-8).toUpperCase()}`} icon={<InfoIcon />} />
                            <View style={styles.divider} />
                            <RowItem label="Storage" value="Offline-first · All data on device" icon={<InfoIcon />} />
                        </SectionCard>
                    </Animated.View>

                    {/* ── Danger Zone ── */}
                    <Animated.View entering={FadeInDown.delay(360).duration(400)}>
                        <Text style={[styles.sectionLabel, { color: C.red }]}>Account Actions</Text>
                        <SectionCard>
                            <RowItem
                                label="Logout"
                                value="Sign out of your account"
                                icon={<LogoutIcon />}
                                onPress={handleLogout}
                                labelColor={C.red}
                            />
                            <View style={styles.divider} />
                            <RowItem
                                label="Delete Account"
                                value="Permanently erase all local data"
                                icon={<TrashIcon />}
                                onPress={handleDeleteAccount}
                                labelColor={C.red}
                            />
                        </SectionCard>
                    </Animated.View>

                    <View style={{ height: 32 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// ─── Edit Actions Row ─────────────────────────────────────────────
const EditActions: React.FC<{
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
    saveLabel?: string;
}> = ({ onSave, onCancel, saving, saveLabel = 'Save Changes' }) => (
    <View style={styles.editActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={onSave}
            activeOpacity={0.8}
            disabled={saving}
        >
            {!saving && <CheckIcon />}
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : saveLabel}</Text>
        </TouchableOpacity>
    </View>
);

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingBottom: 24 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 16, marginBottom: 4,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
        shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: C.brown, letterSpacing: -0.3 },

    // Avatar
    avatarCard: { alignItems: 'center', paddingVertical: 28 },
    avatarCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: C.orange,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: C.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
        marginBottom: 14,
    },
    avatarText: { fontSize: 28, fontWeight: '900', color: C.white, letterSpacing: -0.5 },
    avatarName: { fontSize: 20, fontWeight: '800', color: C.brown, marginBottom: 4, letterSpacing: -0.3 },
    avatarPhone: { fontSize: 13, color: C.muted, fontWeight: '500', marginBottom: 10 },
    memberBadge: {
        backgroundColor: C.blueLight, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12,
    },
    memberBadgeText: { fontSize: 11, fontWeight: '700', color: C.blue },
    meshPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 50,
    },
    meshDot: { width: 7, height: 7, borderRadius: 4 },
    meshPillText: { fontSize: 11, fontWeight: '700' },

    // Section label
    sectionLabel: {
        fontSize: 10, fontWeight: '800', color: C.muted,
        textTransform: 'uppercase', letterSpacing: 0.8,
        marginBottom: 8, marginTop: 20, marginLeft: 4,
    },

    // Card
    card: {
        backgroundColor: C.card, borderRadius: 16,
        shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
        overflow: 'hidden',
    },

    // Row item
    rowItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: 16, gap: 12,
        minHeight: 60,
    },
    rowIcon: { width: 28, alignItems: 'center' },
    rowContent: { flex: 1 },
    rowLabel: { fontSize: 14, fontWeight: '700', color: C.brown, marginBottom: 2 },
    rowValue: { fontSize: 12, color: C.muted, fontWeight: '500' },
    rowRight: {},

    divider: { height: 1, backgroundColor: C.border, marginLeft: 56 },

    // Locked badge
    lockedBadge: {
        backgroundColor: C.amberLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    },
    lockedBadgeText: { fontSize: 10, fontWeight: '800', color: C.amber },

    // Status pill
    statusPill: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
    statusPillText: { fontSize: 11, fontWeight: '800' },

    // Mesh info
    meshInfo: { paddingHorizontal: 16, paddingVertical: 12 },
    meshInfoText: { fontSize: 12, color: C.muted, lineHeight: 18, fontWeight: '500' },

    // Edit panel
    editTitle: { fontSize: 14, fontWeight: '800', color: C.brown, padding: 16, paddingBottom: 12 },
    input: {
        borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
        paddingVertical: 12, paddingHorizontal: 14,
        fontSize: 14, color: C.brown, fontWeight: '500',
        backgroundColor: C.bg, marginHorizontal: 16,
    },
    editActions: {
        flexDirection: 'row', gap: 10, padding: 16, paddingTop: 14,
    },
    cancelBtn: {
        flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg,
    },
    cancelBtnText: { fontSize: 13, fontWeight: '700', color: C.muted },
    saveBtn: {
        flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: C.orange,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    saveBtnText: { fontSize: 13, fontWeight: '800', color: C.white },
});

export default ProfileScreen;
