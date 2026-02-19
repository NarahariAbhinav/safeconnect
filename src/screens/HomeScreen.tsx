/**
 * HomeScreen — fully rewritten with react-native-reanimated
 *
 * Changes from previous version:
 * 1. All old Animated API (useNativeDriver:true) → react-native-reanimated
 *    (fixes the _tracking TypeError on RN 0.81 + New Architecture)
 * 2. PulseDot → useSharedValue + withRepeat
 * 3. PermissionModal → reanimated spring sheet
 * 4. ProfileSheet — new bottom sheet with user info + LOGOUT button
 *    Logout: clears AsyncStorage session → navigates to Onboarding (reset stack)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    PermissionsAndroid,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
    Easing,
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');

// ─── Design Tokens ──────────────────────────────────────────────────
const COLORS = {
    bg: '#EBF4F7',
    orange: '#E05A2B',
    orangeLight: 'rgba(224,90,43,0.12)',
    orangeGlow: 'rgba(224,90,43,0.25)',
    brown: '#2C1A0E',
    brownMid: '#5C3D25',
    green: '#2A7A5A',
    greenLight: 'rgba(42,122,90,0.12)',
    greenBorder: 'rgba(42,122,90,0.28)',
    muted: '#8C7060',
    white: '#FFFFFF',
    cardBg: 'rgba(255,255,255,0.88)',
    cardBorder: 'rgba(44,26,14,0.08)',
    red: '#D32F2F',
    redLight: 'rgba(211,47,47,0.10)',
    blue: '#1565C0',
    blueLight: 'rgba(21,101,192,0.10)',
    amber: '#E65100',
    amberLight: 'rgba(230,81,0,0.10)',
    navBg: '#FFFFFF',
    navBorder: 'rgba(44,26,14,0.10)',
};

// ─── SVG Icons ────────────────────────────────────────────────────
const LogoIcon: React.FC = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Circle cx="5" cy="12" r="2.5" fill="white" />
        <Circle cx="12" cy="5" r="2.5" fill="white" opacity="0.85" />
        <Circle cx="19" cy="12" r="2.5" fill="white" opacity="0.85" />
        <Circle cx="12" cy="19" r="2.5" fill="white" opacity="0.75" />
        <Line x1="7.2" y1="10.5" x2="10" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <Line x1="14" y1="7" x2="16.8" y2="10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <Line x1="7.2" y1="13.5" x2="10" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <Line x1="14" y1="17" x2="16.8" y2="13.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </Svg>
);

const BellIcon: React.FC<{ color?: string }> = ({ color = COLORS.brown }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const ShieldIcon: React.FC<{ color?: string; size?: number }> = ({ color = COLORS.green, size = 20 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2L4 6v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V6L12 2z" stroke={color} strokeWidth="1.8" fill="none" />
        <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const LocationIcon: React.FC<{ color?: string; size?: number }> = ({ color = COLORS.orange, size = 20 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={color} strokeWidth="1.8" fill="none" />
        <Circle cx="12" cy="9" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
    </Svg>
);

const MeshIcon: React.FC<{ color?: string; size?: number }> = ({ color = COLORS.blue, size = 20 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="5" cy="12" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
        <Circle cx="19" cy="12" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
        <Circle cx="12" cy="5" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
        <Circle cx="12" cy="19" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
        <Line x1="7.5" y1="12" x2="16.5" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="12" y1="7.5" x2="12" y2="16.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="6.8" y1="10" x2="10.2" y2="6.8" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        <Line x1="13.8" y1="6.8" x2="17.2" y2="10" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </Svg>
);

const AlertIcon: React.FC<{ color?: string; size?: number }> = ({ color = COLORS.red, size = 20 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth="1.8" fill="none" />
        <Line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Circle cx="12" cy="17" r="0.8" fill={color} />
    </Svg>
);

const SOSSmallIcon: React.FC<{ color?: string }> = ({ color = COLORS.red }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" fill="none" />
        <Path d="M8 10c0-2.2 1.8-4 4-4s4 1.8 4 4c0 1.5-0.8 2.8-2 3.5L12 16l-2-2.5C8.8 12.8 8 11.5 8 10z" stroke={color} strokeWidth="1.5" fill="none" />
        <Circle cx="12" cy="19" r="0.8" fill={color} />
    </Svg>
);

const HomeNavIcon: React.FC<{ color?: string }> = ({ color = COLORS.orange }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={color} strokeWidth="1.8" fill="none" />
        <Path d="M9 22V12h6v10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
);

const MapNavIcon: React.FC<{ color?: string }> = ({ color = COLORS.muted }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round" />
        <Line x1="8" y1="2" x2="8" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="16" y1="6" x2="16" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
);

const ProfileNavIcon: React.FC<{ color?: string }> = ({ color = COLORS.muted }) => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth="1.8" fill="none" />
    </Svg>
);

const LogoutIcon: React.FC = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={COLORS.red} strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M16 17l5-5-5-5M21 12H9" stroke={COLORS.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const ChevronIcon: React.FC<{ color?: string }> = ({ color = COLORS.muted }) => (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

// ─── Pulse Dot (reanimated — New Arch safe) ───────────────────────
const PulseDot: React.FC<{ color?: string }> = ({ color = COLORS.green }) => {
    const scale = useSharedValue(0.85);
    const opacity = useSharedValue(0.5);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 900, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.ease) }),
            ),
            -1, false
        );
        opacity.value = withRepeat(
            withSequence(
                withTiming(1.0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.5, { duration: 900, easing: Easing.inOut(Easing.ease) }),
            ),
            -1, false
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: color,
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return <Animated.View style={style} />;
};

// ─── Mini Mesh Status Widget ──────────────────────────────────────
const MeshStatusWidget: React.FC = () => (
    <Svg width={100} height={50} viewBox="0 0 100 50">
        <Defs>
            <RadialGradient id="ng" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFF8F3" />
                <Stop offset="100%" stopColor="#F5EDE0" />
            </RadialGradient>
        </Defs>
        <Line x1="20" y1="30" x2="50" y2="10" stroke={COLORS.orange} strokeWidth="1.2" strokeOpacity="0.4" strokeDasharray="4 3" />
        <Line x1="50" y1="10" x2="80" y2="20" stroke={COLORS.orange} strokeWidth="1.2" strokeOpacity="0.4" strokeDasharray="4 3" />
        <Line x1="20" y1="30" x2="80" y2="20" stroke={COLORS.green} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="3 4" />
        <Line x1="50" y1="10" x2="50" y2="40" stroke={COLORS.orange} strokeWidth="1" strokeOpacity="0.25" strokeDasharray="3 4" />
        <Circle cx="20" cy="30" r="7" fill="url(#ng)" stroke={COLORS.orange} strokeWidth="1.5" />
        <Circle cx="20" cy="30" r="2.5" fill={COLORS.orange} opacity="0.5" />
        <Circle cx="50" cy="10" r="9" fill="url(#ng)" stroke={COLORS.orange} strokeWidth="2" />
        <Circle cx="50" cy="10" r="3.5" fill={COLORS.orange} opacity="0.6" />
        <Circle cx="80" cy="20" r="7" fill="url(#ng)" stroke={COLORS.green} strokeWidth="1.5" />
        <Circle cx="80" cy="20" r="2.5" fill={COLORS.green} opacity="0.5" />
        <Circle cx="50" cy="40" r="6" fill="url(#ng)" stroke={COLORS.orange} strokeWidth="1.2" />
        <Circle cx="50" cy="40" r="2" fill={COLORS.orange} opacity="0.4" />
        <Circle cx="50" cy="25" r="3" fill={COLORS.orange} opacity="0.7" />
    </Svg>
);

// ─── Quick Action Card ────────────────────────────────────────────
interface QuickActionProps {
    icon: React.ReactNode;
    label: string;
    sublabel: string;
    bgColor: string;
    borderColor: string;
    onPress: () => void;
}
const QuickAction: React.FC<QuickActionProps> = ({ icon, label, sublabel, bgColor, borderColor, onPress }) => (
    <TouchableOpacity
        style={[styles.quickAction, { backgroundColor: bgColor, borderColor }]}
        onPress={onPress}
        activeOpacity={0.75}
    >
        <View style={[styles.quickActionIcon, { backgroundColor: borderColor + '28' }]}>
            {icon}
        </View>
        <Text style={styles.quickActionLabel}>{label}</Text>
        <Text style={styles.quickActionSub}>{sublabel}</Text>
    </TouchableOpacity>
);

// ─── Node Card ────────────────────────────────────────────────────
interface NodeCardProps {
    name: string;
    distance: string;
    signal: number;
    status: 'online' | 'offline';
}
const NodeCard: React.FC<NodeCardProps> = ({ name, distance, signal, status }) => (
    <View style={styles.nodeCard}>
        <View style={styles.nodeLeft}>
            <View style={[styles.nodeAvatar, { backgroundColor: status === 'online' ? COLORS.greenLight : COLORS.redLight }]}>
                <MeshIcon color={status === 'online' ? COLORS.green : COLORS.red} size={16} />
            </View>
            <View>
                <Text style={styles.nodeName}>{name}</Text>
                <Text style={styles.nodeDistance}>{distance} away</Text>
            </View>
        </View>
        <View style={styles.nodeRight}>
            <View style={styles.signalBars}>
                {[1, 2, 3].map(i => (
                    <View
                        key={i}
                        style={[
                            styles.signalBar,
                            { height: 6 + i * 4 },
                            i <= signal
                                ? { backgroundColor: status === 'online' ? COLORS.green : COLORS.muted }
                                : { backgroundColor: 'rgba(44,26,14,0.12)' },
                        ]}
                    />
                ))}
            </View>
            <View style={[styles.statusDot, { backgroundColor: status === 'online' ? COLORS.green : COLORS.muted }]} />
        </View>
    </View>
);

// ─── Alert Card ───────────────────────────────────────────────────
interface AlertCardProps {
    type: 'danger' | 'warning' | 'info';
    title: string;
    message: string;
    time: string;
}
const AlertCard: React.FC<AlertCardProps> = ({ type, title, message, time }) => {
    const config = {
        danger: { bg: COLORS.redLight, border: COLORS.red, icon: <AlertIcon color={COLORS.red} size={16} /> },
        warning: { bg: COLORS.amberLight, border: COLORS.amber, icon: <AlertIcon color={COLORS.amber} size={16} /> },
        info: { bg: COLORS.blueLight, border: COLORS.blue, icon: <ShieldIcon color={COLORS.blue} size={16} /> },
    }[type];

    return (
        <View style={[styles.alertCard, { backgroundColor: config.bg, borderLeftColor: config.border }]}>
            <View style={styles.alertIcon}>{config.icon}</View>
            <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{title}</Text>
                <Text style={styles.alertMessage}>{message}</Text>
            </View>
            <Text style={styles.alertTime}>{time}</Text>
        </View>
    );
};

// ─── Permission Icons ─────────────────────────────────────────────
const LocationPermIcon: React.FC = () => (
    <Svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={COLORS.orange} strokeWidth="2" fill={COLORS.orangeLight} />
        <Circle cx="12" cy="9" r="2.5" stroke={COLORS.orange} strokeWidth="1.8" fill="none" />
    </Svg>
);

const BluetoothPermIcon: React.FC = () => (
    <Svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <Path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" stroke={COLORS.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
);

const WifiPermIcon: React.FC = () => (
    <Svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="19" r="1.5" fill={COLORS.green} />
        <Path d="M4.9 10.1a10 10 0 0114.2 0" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.4" />
        <Path d="M7.8 13a6 6 0 018.4 0" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.65" />
        <Path d="M10.5 16a2.5 2.5 0 013 0" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" fill="none" />
    </Svg>
);

// ─── Permission Modal (reanimated) ────────────────────────────────
interface PermissionModalProps {
    visible: boolean;
    onAllow: () => void;
    onDismiss: () => void;
}

const PermissionModal: React.FC<PermissionModalProps> = ({ visible, onAllow, onDismiss }) => {
    const translateY = useSharedValue(400);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(1, { duration: 280 });
            translateY.value = withSpring(0, { damping: 18, stiffness: 120 });
        }
    }, [visible]);

    const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

    const permissions = [
        { icon: <LocationPermIcon />, title: 'Location Access', desc: 'Required for mesh networking, safe zone alerts, and sharing your location.', bg: COLORS.orangeLight, border: COLORS.orange },
        { icon: <BluetoothPermIcon />, title: 'Bluetooth', desc: 'Enables peer-to-peer mesh networking with nearby SafeConnect users offline.', bg: COLORS.blueLight, border: COLORS.blue },
        { icon: <WifiPermIcon />, title: 'Nearby Devices (Wi-Fi)', desc: 'Allows discovery of nearby mesh nodes and extends your network range.', bg: COLORS.greenLight, border: COLORS.green },
    ];

    return (
        <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
            <Animated.View style={[permStyles.overlay, overlayStyle]}>
                <Animated.View style={[permStyles.sheet, sheetStyle]}>
                    <View style={permStyles.handle} />
                    <View style={permStyles.sheetHeader}>
                        <View style={permStyles.shieldBadge}>
                            <ShieldIcon color={COLORS.white} size={22} />
                        </View>
                        <Text style={permStyles.sheetTitle}>Enable SafeConnect</Text>
                        <Text style={permStyles.sheetSubtitle}>
                            To protect you effectively, SafeConnect needs access to the following services.
                        </Text>
                    </View>
                    {permissions.map((p, i) => (
                        <View key={i} style={[permStyles.permItem, { backgroundColor: p.bg, borderColor: p.border }]}>
                            <View style={[permStyles.permIconWrap, { backgroundColor: p.border + '22' }]}>
                                {p.icon}
                            </View>
                            <View style={permStyles.permText}>
                                <Text style={permStyles.permTitle}>{p.title}</Text>
                                <Text style={permStyles.permDesc}>{p.desc}</Text>
                            </View>
                        </View>
                    ))}
                    <TouchableOpacity style={permStyles.allowBtn} onPress={onAllow} activeOpacity={0.82}>
                        <Text style={permStyles.allowBtnText}>Allow All Permissions</Text>
                    </TouchableOpacity>
                    {/* FIX: 'Not Now' dismisses modal WITHOUT granting permissions */}
                    <TouchableOpacity style={permStyles.skipBtn} onPress={onDismiss} activeOpacity={0.7}>
                        <Text style={permStyles.skipBtnText}>Not Now</Text>
                    </TouchableOpacity>
                    <Text style={permStyles.privacyNote}>
                        🔒 Your data stays on your device. We never sell or share your information.
                    </Text>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

// ─── Profile Sheet ────────────────────────────────────────────────
interface ProfileSheetProps {
    visible: boolean;
    user: any;
    onClose: () => void;
    onLogout: () => void;
}

const ProfileSheet: React.FC<ProfileSheetProps> = ({ visible, user, onClose, onLogout }) => {
    const translateY = useSharedValue(600);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(1, { duration: 250 });
            translateY.value = withSpring(0, { damping: 20, stiffness: 130 });
        } else {
            opacity.value = withTiming(0, { duration: 200 });
            translateY.value = withTiming(600, { duration: 250 });
        }
    }, [visible]);

    const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

    const firstName = user?.firstName || user?.name?.split(' ')[0] || 'User';
    const lastName = user?.lastName || user?.name?.split(' ')[1] || '';
    const email = user?.email || '';
    const phone = user?.phone || '';
    const initials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase();

    const menuItems = [
        { icon: '🔔', label: 'Notifications', sub: 'Alerts & updates' },
        { icon: '🛡️', label: 'Privacy & Safety', sub: 'Data & permissions' },
        { icon: '📡', label: 'Mesh Settings', sub: 'Network configuration' },
        { icon: '❓', label: 'Help & Support', sub: 'FAQs & contact' },
    ];

    return (
        <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onClose}>
            <Animated.View style={[profileStyles.overlay, overlayStyle]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
                <Animated.View style={[profileStyles.sheet, sheetStyle]}>
                    {/* Handle */}
                    <View style={profileStyles.handle} />

                    {/* User Card */}
                    <View style={profileStyles.userCard}>
                        <View style={profileStyles.avatarLarge}>
                            <Text style={profileStyles.avatarLargeText}>{initials}</Text>
                        </View>
                        <View style={profileStyles.userInfo}>
                            <Text style={profileStyles.userName}>{firstName} {lastName}</Text>
                            {email ? <Text style={profileStyles.userEmail}>{email}</Text> : null}
                            {phone ? <Text style={profileStyles.userPhone}>📞 {phone}</Text> : null}
                        </View>
                        <View style={profileStyles.safeBadge}>
                            <View style={profileStyles.safeDot} />
                            <Text style={profileStyles.safeBadgeText}>SAFE</Text>
                        </View>
                    </View>

                    {/* Stats Row */}
                    <View style={profileStyles.statsRow}>
                        <View style={profileStyles.statBox}>
                            <Text style={profileStyles.statNum}>14</Text>
                            <Text style={profileStyles.statLbl}>Nodes</Text>
                        </View>
                        <View style={profileStyles.statDivider} />
                        <View style={profileStyles.statBox}>
                            <Text style={profileStyles.statNum}>3.2km</Text>
                            <Text style={profileStyles.statLbl}>Range</Text>
                        </View>
                        <View style={profileStyles.statDivider} />
                        <View style={profileStyles.statBox}>
                            <Text style={profileStyles.statNum}>98%</Text>
                            <Text style={profileStyles.statLbl}>Uptime</Text>
                        </View>
                    </View>

                    {/* Menu Items */}
                    <ScrollView style={profileStyles.menuList} showsVerticalScrollIndicator={false}>
                        {menuItems.map((item, i) => (
                            <TouchableOpacity key={i} style={profileStyles.menuItem} activeOpacity={0.7}>
                                <Text style={profileStyles.menuIcon}>{item.icon}</Text>
                                <View style={profileStyles.menuText}>
                                    <Text style={profileStyles.menuLabel}>{item.label}</Text>
                                    <Text style={profileStyles.menuSub}>{item.sub}</Text>
                                </View>
                                <ChevronIcon />
                            </TouchableOpacity>
                        ))}

                        {/* ── LOGOUT ── */}
                        <TouchableOpacity
                            style={profileStyles.logoutBtn}
                            activeOpacity={0.82}
                            onPress={onLogout}
                        >
                            <LogoutIcon />
                            <Text style={profileStyles.logoutText}>Sign Out</Text>
                        </TouchableOpacity>

                        <Text style={profileStyles.version}>SafeConnect v1.0.0 · Offline-first mesh</Text>
                    </ScrollView>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────
interface Props {
    navigation: any;
    route?: any;
}

const HomeScreen: React.FC<Props> = ({ navigation, route }) => {
    const user = route?.params?.user;
    const userName = user?.firstName || user?.name || user?.email?.split('@')[0] || 'User';

    const [activeTab, setActiveTab] = useState('home');
    const [showPermModal, setShowPermModal] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    // ── Request permissions on entry (only if not already granted) ──
    useEffect(() => {
        if (Platform.OS !== 'android') return;
        const checkAndShowModal = async () => {
            try {
                const locGranted = await PermissionsAndroid.check(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                );
                if (!locGranted) {
                    const timer = setTimeout(() => setShowPermModal(true), 800);
                    return () => clearTimeout(timer);
                }
            } catch {
                // If check fails, don't show modal
            }
        };
        checkAndShowModal();
    }, []);

    const requestAllPermissions = async () => {
        setShowPermModal(false);
        if (Platform.OS !== 'android') return;
        try {
            await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
                ...(Platform.Version >= 31 ? [
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
                ] : []),
                ...(Platform.Version >= 33 ? [PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES] : []),
            ]);
        } catch (err) {
            console.warn('Permission request error:', err);
        }
    };

    // ── LOGOUT ──
    const handleLogout = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setShowProfile(false);
                        try {
                            // Clear the current user session from AsyncStorage
                            await AsyncStorage.removeItem('safeconnect_currentUser');
                        } catch (e) {
                            console.warn('Logout storage error:', e);
                        }
                        // Navigate to Onboarding and reset the entire stack
                        // so the back button doesn't return to Home
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Onboarding' }],
                        });
                    },
                },
            ]
        );
    };

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const nearbyNodes = [
        { name: 'Node Alpha', distance: '0.3 km', signal: 3, status: 'online' as const },
        { name: 'Node Beta', distance: '0.8 km', signal: 2, status: 'online' as const },
        { name: 'Node Gamma', distance: '1.4 km', signal: 1, status: 'online' as const },
        { name: 'Node Delta', distance: '2.1 km', signal: 0, status: 'offline' as const },
    ];

    const communityAlerts = [
        { type: 'danger' as const, title: 'Road Blocked', message: 'MG Road near station — avoid area', time: '5m ago' },
        { type: 'warning' as const, title: 'Power Outage', message: 'Sector 4 experiencing outage', time: '22m ago' },
        { type: 'info' as const, title: 'Mesh Active', message: '14 nodes online in your area', time: '1h ago' },
    ];

    return (
        <SafeAreaView style={styles.container}>

            {/* ── Permission Modal ── */}
            <PermissionModal
                visible={showPermModal}
                onAllow={requestAllPermissions}
                onDismiss={() => setShowPermModal(false)}
            />

            {/* ── Profile Sheet ── */}
            <ProfileSheet
                visible={showProfile}
                user={user}
                onClose={() => {
                    setShowProfile(false);
                    // FIX: Reset tab highlight when profile sheet is dismissed
                    setActiveTab('home');
                }}
                onLogout={handleLogout}
            />

            {/* ── Top Header ── */}
            <Animated.View entering={FadeInDown.duration(500).delay(0)} style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.logoBadge}>
                        <LogoIcon />
                    </View>
                    <View>
                        <Text style={styles.greeting}>{getGreeting()}</Text>
                        <Text style={styles.userName}>{userName} 👋</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.notifBtn} activeOpacity={0.7}>
                        <BellIcon color={COLORS.brown} />
                        <View style={styles.notifDot} />
                    </TouchableOpacity>
                    {/* Avatar → opens Profile sheet */}
                    <TouchableOpacity
                        style={styles.avatarBtn}
                        onPress={() => setShowProfile(true)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.scrollContent}>

                {/* ── Safety Status Card ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(80)}>
                    <View style={styles.statusCard}>
                        <View style={styles.statusLeft}>
                            <View style={styles.statusBadge}>
                                <PulseDot color={COLORS.green} />
                                <Text style={styles.statusBadgeText}>SAFE</Text>
                            </View>
                            <Text style={styles.statusTitle}>You're Protected</Text>
                            <Text style={styles.statusSubtitle}>Mesh network active · 14 nodes nearby</Text>
                            <View style={styles.statusStats}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>14</Text>
                                    <Text style={styles.statLabel}>Nodes</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>3.2km</Text>
                                    <Text style={styles.statLabel}>Range</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>98%</Text>
                                    <Text style={styles.statLabel}>Uptime</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.statusRight}>
                            <MeshStatusWidget />
                        </View>
                    </View>
                </Animated.View>

                {/* ── Quick Actions ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(180)}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.quickActionsGrid}>
                        <QuickAction
                            icon={<SOSSmallIcon color={COLORS.red} />}
                            label="SOS Alert"
                            sublabel="Emergency"
                            bgColor={COLORS.redLight}
                            borderColor={COLORS.red}
                            onPress={() => navigation.navigate('EmergencyAccess')}
                        />
                        <QuickAction
                            icon={<LocationIcon color={COLORS.orange} />}
                            label="Share Location"
                            sublabel="Live tracking"
                            bgColor={COLORS.orangeLight}
                            borderColor={COLORS.orange}
                            onPress={() => { }}
                        />
                        <QuickAction
                            icon={<MeshIcon color={COLORS.blue} />}
                            label="Mesh Network"
                            sublabel="Connect nodes"
                            bgColor={COLORS.blueLight}
                            borderColor={COLORS.blue}
                            onPress={() => { }}
                        />
                        <QuickAction
                            icon={<ShieldIcon color={COLORS.green} />}
                            label="Safe Zone"
                            sublabel="Set perimeter"
                            bgColor={COLORS.greenLight}
                            borderColor={COLORS.green}
                            onPress={() => { }}
                        />
                    </View>
                </Animated.View>

                {/* ── Nearby Mesh Nodes ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(280)}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Nearby Nodes</Text>
                        <TouchableOpacity activeOpacity={0.7}>
                            <Text style={styles.seeAll}>See all →</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.nodesCard}>
                        {nearbyNodes.map((node, i) => (
                            <View key={node.name}>
                                <NodeCard {...node} />
                                {i < nearbyNodes.length - 1 && <View style={styles.nodeDivider} />}
                            </View>
                        ))}
                    </View>
                </Animated.View>

                {/* ── Community Alerts ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(380)} style={{ marginBottom: 24 }}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Community Alerts</Text>
                        <TouchableOpacity activeOpacity={0.7}>
                            <Text style={styles.seeAll}>See all →</Text>
                        </TouchableOpacity>
                    </View>
                    {communityAlerts.map((alert, i) => (
                        <AlertCard key={i} {...alert} />
                    ))}
                </Animated.View>

            </ScrollView>

            {/* ── Bottom Navigation ── */}
            <View style={styles.bottomNav}>
                {[
                    { id: 'home', label: 'Home', icon: (c: string) => <HomeNavIcon color={c} /> },
                    { id: 'map', label: 'Map', icon: (c: string) => <MapNavIcon color={c} /> },
                    { id: 'alerts', label: 'Alerts', icon: (c: string) => <AlertIcon color={c} size={22} /> },
                    { id: 'profile', label: 'Profile', icon: (c: string) => <ProfileNavIcon color={c} /> },
                ].map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={styles.navItem}
                            onPress={() => {
                                setActiveTab(tab.id);
                                if (tab.id === 'profile') {
                                    setShowProfile(true);
                                }
                            }}
                            activeOpacity={0.7}
                        >
                            {tab.icon(isActive ? COLORS.orange : COLORS.muted)}
                            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                                {tab.label}
                            </Text>
                            {isActive && <View style={styles.navActiveDot} />}
                        </TouchableOpacity>
                    );
                })}
            </View>

        </SafeAreaView>
    );
};

// ─── Permission Styles ────────────────────────────────────────────
const permStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(44,26,14,0.55)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(44,26,14,0.15)', alignSelf: 'center', marginBottom: 20 },
    sheetHeader: { alignItems: 'center', marginBottom: 20 },
    shieldBadge: { width: 56, height: 56, borderRadius: 18, backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: COLORS.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
    sheetTitle: { fontSize: 22, fontWeight: '800', color: COLORS.brown, letterSpacing: -0.5, marginBottom: 6, textAlign: 'center' },
    sheetSubtitle: { fontSize: 13, fontWeight: '500', color: COLORS.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 10 },
    permItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 12, marginBottom: 10 },
    permIconWrap: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    permText: { flex: 1 },
    permTitle: { fontSize: 14, fontWeight: '700', color: COLORS.brown, letterSpacing: -0.2, marginBottom: 3 },
    permDesc: { fontSize: 11, fontWeight: '500', color: COLORS.brownMid, lineHeight: 16 },
    allowBtn: { backgroundColor: COLORS.orange, borderRadius: 100, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 12, shadowColor: COLORS.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    allowBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
    skipBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 4 },
    skipBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.muted, letterSpacing: 0.1 },
    privacyNote: { fontSize: 11, fontWeight: '500', color: COLORS.muted, textAlign: 'center', lineHeight: 16 },
});

// ─── Profile Sheet Styles ─────────────────────────────────────────
const profileStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(44,26,14,0.50)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: COLORS.bg,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 12,
        maxHeight: '88%',
    },
    handle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: 'rgba(44,26,14,0.15)',
        alignSelf: 'center',
        marginBottom: 16,
    },

    // User card
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: COLORS.white,
        marginHorizontal: 16,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        shadowColor: COLORS.brown,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    avatarLarge: {
        width: 56, height: 56, borderRadius: 18,
        backgroundColor: COLORS.orange,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: COLORS.orange,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    avatarLargeText: {
        fontSize: 22, fontWeight: '800', color: COLORS.white,
    },
    userInfo: { flex: 1 },
    userName: {
        fontSize: 17, fontWeight: '800', color: COLORS.brown,
        letterSpacing: -0.4, marginBottom: 2,
    },
    userEmail: {
        fontSize: 12, fontWeight: '500', color: COLORS.muted,
        marginBottom: 1,
    },
    userPhone: {
        fontSize: 12, fontWeight: '500', color: COLORS.muted,
    },
    safeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: COLORS.greenLight,
        borderWidth: 1, borderColor: COLORS.greenBorder,
        borderRadius: 100, paddingVertical: 4, paddingHorizontal: 8,
    },
    safeDot: {
        width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green,
    },
    safeBadgeText: {
        fontSize: 9, fontWeight: '800', color: COLORS.green, letterSpacing: 0.8,
    },

    // Stats
    statsRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.white,
        marginHorizontal: 16, borderRadius: 16,
        paddingVertical: 14, marginBottom: 12,
        shadowColor: COLORS.brown,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    statBox: { flex: 1, alignItems: 'center' },
    statNum: { fontSize: 18, fontWeight: '800', color: COLORS.brown, letterSpacing: -0.5 },
    statLbl: { fontSize: 10, fontWeight: '500', color: COLORS.muted, marginTop: 2 },
    statDivider: { width: 1, height: 28, backgroundColor: 'rgba(44,26,14,0.08)' },

    // Menu
    menuList: { paddingHorizontal: 16 },
    menuItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: COLORS.white, borderRadius: 14,
        paddingHorizontal: 14, paddingVertical: 13,
        marginBottom: 8,
    },
    menuIcon: { fontSize: 20 },
    menuText: { flex: 1 },
    menuLabel: { fontSize: 14, fontWeight: '700', color: COLORS.brown, letterSpacing: -0.2 },
    menuSub: { fontSize: 11, fontWeight: '500', color: COLORS.muted, marginTop: 1 },

    // Logout
    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, marginTop: 8, marginBottom: 8,
        backgroundColor: 'rgba(211,47,47,0.08)',
        borderWidth: 1.5, borderColor: 'rgba(211,47,47,0.25)',
        borderRadius: 14, paddingVertical: 14,
    },
    logoutText: {
        fontSize: 15, fontWeight: '700', color: COLORS.red, letterSpacing: 0.1,
    },
    version: {
        fontSize: 11, fontWeight: '500', color: COLORS.muted,
        textAlign: 'center', paddingVertical: 16,
    },
});

// ─── Main Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoBadge: { width: 42, height: 42, backgroundColor: COLORS.orange, borderRadius: 13, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.orange, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
    greeting: { fontSize: 11, fontWeight: '500', color: COLORS.muted, letterSpacing: 0.2 },
    userName: { fontSize: 16, fontWeight: '800', color: COLORS.brown, letterSpacing: -0.3 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    notifBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: 'center', justifyContent: 'center' },
    notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.red, borderWidth: 1.5, borderColor: COLORS.bg },
    avatarBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.orange, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 3 },
    avatarText: { fontSize: 16, fontWeight: '800', color: COLORS.white },

    // Scroll
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 18, paddingBottom: 20 },

    // Status Card
    statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderWidth: 1.5, borderColor: COLORS.greenBorder, borderRadius: 20, padding: 18, marginBottom: 22, shadowColor: COLORS.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
    statusLeft: { flex: 1 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.greenLight, borderWidth: 1, borderColor: COLORS.greenBorder, borderRadius: 100, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start', marginBottom: 10 },
    statusBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.green, letterSpacing: 1 },
    statusTitle: { fontSize: 20, fontWeight: '900', color: COLORS.brown, letterSpacing: -0.5, marginBottom: 3 },
    statusSubtitle: { fontSize: 11, fontWeight: '500', color: COLORS.muted, marginBottom: 14 },
    statusStats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: 16, fontWeight: '800', color: COLORS.brown, letterSpacing: -0.3 },
    statLabel: { fontSize: 10, fontWeight: '500', color: COLORS.muted },
    statDivider: { width: 1, height: 24, backgroundColor: 'rgba(44,26,14,0.10)' },
    statusRight: { marginLeft: 8 },

    // Section
    sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.brown, letterSpacing: -0.4, marginBottom: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    seeAll: { fontSize: 12, fontWeight: '600', color: COLORS.orange, letterSpacing: 0.1 },

    // Quick Actions
    quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
    quickAction: { width: (width - 36 - 10) / 2, borderWidth: 1.5, borderRadius: 16, padding: 14, gap: 6 },
    quickActionIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    quickActionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.brown, letterSpacing: -0.2 },
    quickActionSub: { fontSize: 11, fontWeight: '500', color: COLORS.muted },

    // Nodes
    nodesCard: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 18, overflow: 'hidden', marginBottom: 22 },
    nodeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
    nodeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    nodeAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    nodeName: { fontSize: 13, fontWeight: '700', color: COLORS.brown, letterSpacing: -0.2 },
    nodeDistance: { fontSize: 11, fontWeight: '500', color: COLORS.muted },
    nodeRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    signalBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
    signalBar: { width: 4, borderRadius: 2 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    nodeDivider: { height: 1, backgroundColor: 'rgba(44,26,14,0.06)', marginHorizontal: 14 },

    // Alerts
    alertCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderLeftWidth: 3, borderRadius: 12, padding: 12, marginBottom: 8 },
    alertIcon: { marginTop: 1 },
    alertContent: { flex: 1 },
    alertTitle: { fontSize: 13, fontWeight: '700', color: COLORS.brown, letterSpacing: -0.2, marginBottom: 2 },
    alertMessage: { fontSize: 11, fontWeight: '500', color: COLORS.brownMid, lineHeight: 16 },
    alertTime: { fontSize: 10, fontWeight: '500', color: COLORS.muted, marginTop: 1 },

    // Bottom Nav
    bottomNav: { flexDirection: 'row', backgroundColor: COLORS.navBg, borderTopWidth: 1, borderTopColor: COLORS.navBorder, paddingBottom: 8, paddingTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
    navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4, position: 'relative' },
    navLabel: { fontSize: 10, fontWeight: '600', color: COLORS.muted, letterSpacing: 0.1 },
    navLabelActive: { color: COLORS.orange },
    navActiveDot: { position: 'absolute', bottom: -4, width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.orange },
});

export default HomeScreen;
