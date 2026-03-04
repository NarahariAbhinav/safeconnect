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
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Linking,
    Modal,
    PermissionsAndroid,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
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
import Svg, { Circle, Defs, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { TrustedContact, contactsService } from '../services/contacts';
import { locationService } from '../services/location';
import LocationSharingModal from './LocationSharingModal_v2';

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

// ─── Emergency Mode Icons ─────────────────────────────────────────
const EmergencyIcon: React.FC<{ color?: string; size?: number }> = ({ color = COLORS.red, size = 22 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke={color} strokeWidth="1.8" fill="none" />
        <Path d="M12 8v4M12 16h.01" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
);

const PhoneCallIcon: React.FC<{ color?: string; size?: number }> = ({ color = COLORS.blue, size = 20 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke={color} strokeWidth="1.8" fill="none" />
    </Svg>
);

const AmbulanceIcon: React.FC<{ color?: string; size?: number }> = ({ color = COLORS.red, size = 20 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="1" y="10" width="22" height="9" rx="2" stroke={color} strokeWidth="1.8" fill="none" />
        <Path d="M1 14h22M7 19v2M17 19v2M5 10V6a2 2 0 012-2h4l3 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M13 6h3l2 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 6v4M8 8h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
);

const FireIcon: React.FC<{ color?: string; size?: number }> = ({ color = COLORS.amber, size = 20 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 23c-4.97 0-9-2.69-9-6 0-2.5 1.5-4.5 3-6 .5-.5 1.5-1 2-2 1 2 2 3 3 3s2-1 2-3c2 3 5 5 5 8 0 3.31-2.69 6-6 6z" stroke={color} strokeWidth="1.8" fill="none" />
        <Path d="M12 23c-1.66 0-3-1.12-3-2.5S10.34 17 12 17s3 2.12 3 3.5S13.66 23 12 23z" stroke={color} strokeWidth="1.5" fill="none" />
    </Svg>
);

const LiveLocationPinIcon: React.FC<{ color?: string; size?: number }> = ({ color = COLORS.orange, size = 18 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={color} opacity={0.15} stroke={color} strokeWidth="1.8" />
        <Circle cx="12" cy="9" r="2.5" fill={color} />
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

// ─── Contact Card ───────────────────────────────────────────────
interface ContactCardProps {
    name: string;
    relationship: string;
    phone: string;
}
const ContactCard: React.FC<ContactCardProps> = ({ name, relationship, phone }) => {
    const initials = name
        .split(' ')
        .map(part => part.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <View style={styles.contactRow}>
            <View style={styles.contactLeft}>
                <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{initials}</Text>
                </View>
                <View>
                    <Text style={styles.contactName}>{name}</Text>
                    <Text style={styles.contactMeta}>{relationship}</Text>
                </View>
            </View>
            <View style={styles.contactRight}>
                <Text style={styles.contactPhone}>{phone}</Text>
                <View style={styles.contactAction}>
                    <Text style={styles.contactActionText}>Call</Text>
                </View>
            </View>
        </View>
    );
};

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
    const [showLocationSharing, setShowLocationSharing] = useState(false);
    const [showContactPicker, setShowContactPicker] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [activeFeature, setActiveFeature] = useState<'nodes' | 'contacts' | 'alerts' | null>('contacts');
    const [emergencyMode, setEmergencyMode] = useState(false);
    const [liveLocation, setLiveLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [liveAddress, setLiveAddress] = useState<string>('Fetching location...');
    const [trustedContacts, setTrustedContacts] = useState<TrustedContact[]>([]);

    // ── Load real trusted contacts; refresh whenever screen is focused ──
    useFocusEffect(
        useCallback(() => {
            contactsService.getTrusted().then(setTrustedContacts);
        }, [])
    );

    // ── Always show permission modal on every HomeScreen open ──
    useEffect(() => {
        const timer = setTimeout(() => setShowPermModal(true), 600);
        return () => clearTimeout(timer);
    }, []);

    // ── Live Location (fetches once, refreshes quietly every 60 s) ──
    const isFetchingRef = useRef(false);

    const fetchLiveLocation = useCallback(async () => {
        if (isFetchingRef.current) return;   // skip if already in-flight
        isFetchingRef.current = true;
        try {
            const hasPermission = await locationService.checkLocationPermission();
            if (!hasPermission) {
                setLiveAddress('Location permission not granted');
                return;
            }
            const loc = await locationService.getCurrentLocation();
            if (loc) {
                setLiveLocation({ latitude: loc.latitude, longitude: loc.longitude });
                const addr = await locationService.getAddressFromCoordinates(loc.latitude, loc.longitude);
                setLiveAddress(addr || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
            }
        } catch {
            setLiveAddress('Unable to fetch location');
        } finally {
            isFetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        fetchLiveLocation();
        const interval = setInterval(fetchLiveLocation, 60_000); // refresh every 60 s
        return () => clearInterval(interval);
    }, [fetchLiveLocation]);

    // ── Emergency Mode → navigate to full SOS hub ──
    const toggleEmergencyMode = () => {
        if (!emergencyMode) {
            // Navigate to SOS hub — it handles activation, SMS, and deactivation
            navigation.navigate('SOSScreen', {
                userId: user?.id ?? user?.email ?? 'anonymous',
                userName,
            });
        } else {
            Alert.alert(
                'Deactivate Emergency Mode',
                'Are you sure you want to turn off emergency mode?',
                [
                    { text: 'Keep Active', style: 'cancel' },
                    {
                        text: 'Deactivate',
                        onPress: () => setEmergencyMode(false),
                    },
                ]
            );
        }
    };

    const callEmergencyService = (service: string, number: string) => {
        Alert.alert(
            `Call ${service}`,
            `Dial ${number}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Call', onPress: () => Linking.openURL(`tel:${number}`) },
            ]
        );
    };

    const requestAllPermissions = async () => {
        setShowPermModal(false);

        // ── Step 1: Grant runtime permissions (Android only) ──────────
        if (Platform.OS === 'android') {
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
            } catch {
                // Permission request errors are non-critical
            }
        }

        // ── Step 2: Actually turn ON Bluetooth ────────────────────────
        // Runtime permissions only allow the app to USE Bluetooth APIs.
        // To turn the radio ON we must fire the system's REQUEST_ENABLE intent.
        try {
            // This opens Android's "Do you want to turn on Bluetooth?" system dialog.
            await Linking.openURL('android-app://com.android.settings/.bluetooth.RequestPermissionActivity');
        } catch {
            // Fallback: some ROMs block that deep link — use the general BT settings page
            try {
                await Linking.openURL('android.settings.BLUETOOTH_SETTINGS');
            } catch {
                // Last resort: prompt user to enable manually
                Alert.alert(
                    '🔵 Enable Bluetooth',
                    'Please turn on Bluetooth in your device Settings to enable mesh networking.\n\nSettings → Connections → Bluetooth → ON',
                    [
                        { text: 'Open Settings', onPress: () => Linking.openSettings() },
                        { text: 'Later', style: 'cancel' },
                    ]
                );
            }
        }

        // ── Step 3: After Bluetooth, prompt for WiFi (non-blocking) ──
        setTimeout(() => {
            Alert.alert(
                '📶 Enable Wi-Fi',
                'For best mesh networking range, please also ensure Wi-Fi is turned on.',
                [
                    {
                        text: 'Open Wi-Fi Settings',
                        onPress: () => {
                            Linking.openURL('android.settings.WIFI_SETTINGS').catch(() =>
                                Linking.openSettings()
                            );
                        },
                    },
                    { text: 'Already On', style: 'cancel' },
                ]
            );
        }, 1500); // slight delay so BT dialog doesn't clash
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
                        } catch {
                            // Ignore storage error during logout
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

    const handleLocationShare = (duration: number) => {
        const durationText = duration === -1 ? 'continuous' : `${duration} minutes`;
        Alert.alert(
            '✅ Location Shared!',
            `Your location is now being shared for ${durationText}.\n\nYour trusted contacts can see your real-time location.`,
            [{ text: 'OK' }]
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

    // contacts come from trustedContacts state (real device contacts)
    const contactsForDisplay = trustedContacts.slice(0, 5); // show top 5

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

            {/* ── Location Sharing Modal ── */}
            <LocationSharingModal
                visible={showLocationSharing}
                userName={userName}
                onClose={() => setShowLocationSharing(false)}
                onShare={handleLocationShare}
            />

            {/* ── Contact Picker Modal (for Share Location) ── */}
            <Modal
                transparent
                visible={showContactPicker}
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => setShowContactPicker(false)}
            >
                <View style={cpStyles.overlay}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFillObject}
                        activeOpacity={1}
                        onPress={() => setShowContactPicker(false)}
                    />
                    <View style={cpStyles.sheet}>
                        <View style={cpStyles.handle} />
                        {/* Header */}
                        <View style={cpStyles.header}>
                            <View style={cpStyles.headerIconWrap}>
                                <LocationIcon color={COLORS.white} size={20} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={cpStyles.title}>Share Live Location</Text>
                                <Text style={cpStyles.subtitle}>Choose contacts to share your location with</Text>
                            </View>
                        </View>

                        {/* Contacts List — use real trustedContacts */}
                        <Text style={cpStyles.sectionLabel}>TOP CONTACTS</Text>
                        {trustedContacts.length === 0 ? (
                            <Text style={{ color: COLORS.muted, fontSize: 13, textAlign: 'center', marginVertical: 20 }}>
                                No trusted contacts yet.{' '}
                                <Text
                                    style={{ color: COLORS.orange, fontWeight: '700' }}
                                    onPress={() => { setShowContactPicker(false); navigation.navigate('ContactsManager'); }}
                                >
                                    Add some →
                                </Text>
                            </Text>
                        ) : trustedContacts.map((contact) => {
                            const isSelected = selectedContacts.includes(contact.id);
                            const initials = contactsService.getInitials(contact.name);
                            return (
                                <TouchableOpacity
                                    key={contact.id}
                                    style={[cpStyles.contactRow, isSelected && cpStyles.contactRowSelected]}
                                    activeOpacity={0.75}
                                    onPress={() => {
                                        setSelectedContacts(prev =>
                                            prev.includes(contact.id)
                                                ? prev.filter(n => n !== contact.id)
                                                : [...prev, contact.id]
                                        );
                                    }}
                                >
                                    <View style={[cpStyles.avatar, isSelected && cpStyles.avatarSelected]}>
                                        <Text style={[cpStyles.avatarText, isSelected && cpStyles.avatarTextSelected]}>
                                            {initials}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={cpStyles.contactName}>{contact.name}</Text>
                                        <Text style={cpStyles.contactMeta}>{contact.relationship} · {contact.phone}</Text>
                                    </View>
                                    <View style={[cpStyles.checkCircle, isSelected && cpStyles.checkCircleSelected]}>
                                        {isSelected && <Text style={cpStyles.checkMark}>✓</Text>}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {/* Share Button */}
                        <TouchableOpacity
                            style={[
                                cpStyles.shareBtn,
                                selectedContacts.length === 0 && cpStyles.shareBtnDisabled,
                            ]}
                            activeOpacity={0.82}
                            disabled={selectedContacts.length === 0}
                            onPress={() => {
                                setShowContactPicker(false);
                                setTimeout(() => setShowLocationSharing(true), 300);
                            }}
                        >
                            <Text style={cpStyles.shareBtnText}>
                                {selectedContacts.length === 0
                                    ? 'Select at least one contact'
                                    : `Share with ${selectedContacts.length} contact${selectedContacts.length > 1 ? 's' : ''}`}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={cpStyles.cancelBtn}
                            onPress={() => setShowContactPicker(false)}
                            activeOpacity={0.7}
                        >
                            <Text style={cpStyles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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

                {/* ── Emergency Mode Card ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(80)}>
                    <View style={[styles.emergencyCard, emergencyMode && styles.emergencyCardActive]}>
                        <View style={styles.emergencyHeader}>
                            <View style={styles.emergencyHeaderLeft}>
                                <View style={[styles.emergencyIconWrap, emergencyMode && styles.emergencyIconWrapActive]}>
                                    <EmergencyIcon color={emergencyMode ? COLORS.white : COLORS.red} size={24} />
                                </View>
                                <View>
                                    <Text style={[styles.emergencyTitle, emergencyMode && styles.emergencyTitleActive]}>
                                        {emergencyMode ? 'Emergency Active' : 'Emergency Mode'}
                                    </Text>
                                    <Text style={[styles.emergencySubtitle, emergencyMode && styles.emergencySubtitleActive]}>
                                        {emergencyMode ? 'Contacts alerted · Services ready' : 'Activate for instant safety'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[styles.emergencyToggle, emergencyMode && styles.emergencyToggleActive]}
                                onPress={toggleEmergencyMode}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.emergencyToggleText, emergencyMode && styles.emergencyToggleTextActive]}>
                                    {emergencyMode ? 'ACTIVE' : 'ACTIVATE'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Emergency Services */}
                        <View style={styles.emergencyServices}>
                            <TouchableOpacity
                                style={[styles.emergencyServiceBtn, { backgroundColor: COLORS.blueLight, borderColor: COLORS.blue }]}
                                onPress={() => callEmergencyService('Police', '100')}
                                activeOpacity={0.75}
                            >
                                <PhoneCallIcon color={COLORS.blue} size={18} />
                                <Text style={[styles.emergencyServiceLabel, { color: COLORS.blue }]}>Police</Text>
                                <Text style={[styles.emergencyServiceNum, { color: COLORS.blue }]}>100</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.emergencyServiceBtn, { backgroundColor: COLORS.redLight, borderColor: COLORS.red }]}
                                onPress={() => callEmergencyService('Ambulance', '108')}
                                activeOpacity={0.75}
                            >
                                <AmbulanceIcon color={COLORS.red} size={18} />
                                <Text style={[styles.emergencyServiceLabel, { color: COLORS.red }]}>Ambulance</Text>
                                <Text style={[styles.emergencyServiceNum, { color: COLORS.red }]}>108</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.emergencyServiceBtn, { backgroundColor: COLORS.amberLight, borderColor: COLORS.amber }]}
                                onPress={() => callEmergencyService('Fire', '101')}
                                activeOpacity={0.75}
                            >
                                <FireIcon color={COLORS.amber} size={18} />
                                <Text style={[styles.emergencyServiceLabel, { color: COLORS.amber }]}>Fire</Text>
                                <Text style={[styles.emergencyServiceNum, { color: COLORS.amber }]}>101</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>

                {/* ── Live Location Section ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(130)}>
                    <TouchableOpacity style={styles.liveLocationCard} onPress={fetchLiveLocation} activeOpacity={0.8}>
                        <View style={styles.liveLocationLeft}>
                            <View style={styles.liveLocationIconWrap}>
                                <LiveLocationPinIcon color={COLORS.orange} size={18} />
                            </View>
                            <View style={styles.liveLocationText}>
                                <View style={styles.liveLocationHeader}>
                                    <PulseDot color={COLORS.green} />
                                    <Text style={styles.liveLocationLabel}>Live Location</Text>
                                </View>
                                <Text style={styles.liveLocationAddress} numberOfLines={1}>
                                    {liveAddress}
                                </Text>
                            </View>
                        </View>
                        <ChevronIcon color={COLORS.muted} />
                    </TouchableOpacity>
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
                            onPress={() => {
                                setSelectedContacts([]);
                                setShowContactPicker(true);
                            }}
                        />
                        <QuickAction
                            icon={<MeshIcon color={COLORS.blue} />}
                            label="Mesh Chat"
                            sublabel="Offline messaging"
                            bgColor={COLORS.blueLight}
                            borderColor={COLORS.blue}
                            onPress={() => navigation.navigate('MeshChat', {
                                userId: user?.id ?? user?.email ?? 'anonymous',
                                userName,
                            })}
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

                {/* ── Feature Tabs ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(260)}>
                    <View style={styles.featureTabsRow}>
                        {[
                            { id: 'contacts' as const, label: 'Contacts' },
                            { id: 'nodes' as const, label: 'Nearby Nodes' },
                            { id: 'alerts' as const, label: 'Community Alerts' },
                        ].map(tab => {
                            const isActive = activeFeature === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.featureTab, isActive && styles.featureTabActive]}
                                    onPress={() => setActiveFeature(isActive ? null : tab.id)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[styles.featureTabText, isActive && styles.featureTabTextActive]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>

                {/* ── Feature Panels ── */}
                {activeFeature === 'nodes' && (
                    <Animated.View entering={FadeInUp.duration(350)}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Nearby Nodes</Text>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => navigation.navigate('MeshStatus', {
                                    userId: user?.id ?? user?.email ?? 'anonymous',
                                    userName,
                                })}
                            >
                                <Text style={styles.seeAll}>Open Monitor →</Text>
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
                )}

                {activeFeature === 'contacts' && (
                    <Animated.View entering={FadeInUp.duration(350)}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Contacts</Text>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => navigation.navigate('ContactsManager')}
                            >
                                <Text style={styles.seeAll}>Manage →</Text>
                            </TouchableOpacity>
                        </View>
                        {contactsForDisplay.length === 0 ? (
                            <TouchableOpacity
                                style={styles.emptyContactsCard}
                                onPress={() => navigation.navigate('ContactsManager')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.emptyContactsEmoji}>👥</Text>
                                <Text style={styles.emptyContactsTitle}>No Trusted Contacts</Text>
                                <Text style={styles.emptyContactsSub}>Tap to add people from your contacts</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.contactsCard}>
                                {contactsForDisplay.map((contact, i) => (
                                    <View key={contact.id}>
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => navigation.navigate('ContactDetail', { contactId: contact.id })}
                                        >
                                            <ContactCard
                                                name={contact.name}
                                                relationship={contact.relationship}
                                                phone={contact.phone}
                                            />
                                        </TouchableOpacity>
                                        {i < contactsForDisplay.length - 1 && <View style={styles.nodeDivider} />}
                                    </View>
                                ))}
                            </View>
                        )}
                    </Animated.View>
                )}

                {activeFeature === 'alerts' && (
                    <Animated.View entering={FadeInUp.duration(350)} style={{ marginBottom: 24 }}>
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
                )}

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

// ─── Contact Picker Styles ──────────────────────────────────────────────────
const cpStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(44,26,14,0.52)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 18,
        paddingBottom: 36,
        paddingTop: 12,
    },
    handle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: 'rgba(44,26,14,0.15)',
        alignSelf: 'center',
        marginBottom: 18,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    headerIconWrap: {
        width: 44, height: 44, borderRadius: 13,
        backgroundColor: COLORS.orange,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: COLORS.orange,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    title: {
        fontSize: 17, fontWeight: '800', color: COLORS.brown, letterSpacing: -0.4,
    },
    subtitle: {
        fontSize: 12, fontWeight: '500', color: COLORS.muted, marginTop: 2,
    },
    sectionLabel: {
        fontSize: 10, fontWeight: '700', color: COLORS.muted,
        letterSpacing: 1.2, marginBottom: 10, marginLeft: 2,
    },
    contactRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: COLORS.bg,
        borderWidth: 1.5, borderColor: 'transparent',
        borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11,
        marginBottom: 8,
    },
    contactRowSelected: {
        backgroundColor: COLORS.orangeLight,
        borderColor: COLORS.orange,
    },
    avatar: {
        width: 42, height: 42, borderRadius: 13,
        backgroundColor: COLORS.greenLight,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarSelected: { backgroundColor: COLORS.orange },
    avatarText: { fontSize: 14, fontWeight: '800', color: COLORS.green },
    avatarTextSelected: { color: COLORS.white },
    contactName: { fontSize: 14, fontWeight: '700', color: COLORS.brown, letterSpacing: -0.2 },
    contactMeta: { fontSize: 11, fontWeight: '500', color: COLORS.muted, marginTop: 1 },
    checkCircle: {
        width: 24, height: 24, borderRadius: 12,
        borderWidth: 1.5, borderColor: 'rgba(44,26,14,0.20)',
        backgroundColor: COLORS.white,
        alignItems: 'center', justifyContent: 'center',
    },
    checkCircleSelected: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
    checkMark: { fontSize: 12, fontWeight: '800', color: COLORS.white, lineHeight: 14 },
    shareBtn: {
        backgroundColor: COLORS.orange, borderRadius: 100,
        paddingVertical: 16, alignItems: 'center',
        marginTop: 18, marginBottom: 10,
        shadowColor: COLORS.orange,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
    },
    shareBtnDisabled: { backgroundColor: 'rgba(44,26,14,0.12)', shadowOpacity: 0, elevation: 0 },
    shareBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white, letterSpacing: 0.1 },
    cancelBtn: { alignItems: 'center', paddingVertical: 8 },
    cancelBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
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

    // Emergency Mode Card
    emergencyCard: {
        backgroundColor: COLORS.cardBg, borderWidth: 1.5, borderColor: 'rgba(211,47,47,0.20)',
        borderRadius: 20, padding: 16, marginBottom: 14,
        shadowColor: COLORS.red, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
    },
    emergencyCardActive: {
        backgroundColor: 'rgba(211,47,47,0.06)', borderColor: COLORS.red,
        shadowOpacity: 0.15,
    },
    emergencyHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
    },
    emergencyHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    emergencyIconWrap: {
        width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.redLight,
        alignItems: 'center', justifyContent: 'center',
    },
    emergencyIconWrapActive: { backgroundColor: COLORS.red },
    emergencyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.brown, letterSpacing: -0.3 },
    emergencyTitleActive: { color: COLORS.red },
    emergencySubtitle: { fontSize: 11, fontWeight: '500', color: COLORS.muted, marginTop: 1 },
    emergencySubtitleActive: { color: COLORS.red },
    emergencyToggle: {
        backgroundColor: COLORS.redLight, borderWidth: 1.5, borderColor: COLORS.red,
        borderRadius: 100, paddingVertical: 8, paddingHorizontal: 16,
    },
    emergencyToggleActive: { backgroundColor: COLORS.red },
    emergencyToggleText: { fontSize: 11, fontWeight: '800', color: COLORS.red, letterSpacing: 0.8 },
    emergencyToggleTextActive: { color: COLORS.white },
    emergencyServices: { flexDirection: 'row', gap: 8 },
    emergencyServiceBtn: {
        flex: 1, borderWidth: 1.5, borderRadius: 14, paddingVertical: 10,
        alignItems: 'center', gap: 4,
    },
    emergencyServiceLabel: { fontSize: 11, fontWeight: '700', letterSpacing: -0.2 },
    emergencyServiceNum: { fontSize: 10, fontWeight: '600', opacity: 0.7 },

    // Live Location Card
    liveLocationCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.cardBorder,
        borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 22,
    },
    liveLocationLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    liveLocationIconWrap: {
        width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.orangeLight,
        alignItems: 'center', justifyContent: 'center',
    },
    liveLocationText: { flex: 1 },
    liveLocationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    liveLocationLabel: { fontSize: 12, fontWeight: '700', color: COLORS.brown, letterSpacing: -0.2 },
    liveLocationAddress: { fontSize: 11, fontWeight: '500', color: COLORS.muted, lineHeight: 15 },

    // Legacy (kept for compat)
    statDivider: { width: 1, height: 24, backgroundColor: 'rgba(44,26,14,0.10)' },

    // Section
    sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.brown, letterSpacing: -0.4, marginBottom: 14 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    seeAll: { fontSize: 12, fontWeight: '600', color: COLORS.orange, letterSpacing: 0.1 },

    // Feature Tabs
    featureTabsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 },
    featureTab: { flex: 1, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
    featureTabActive: { borderColor: COLORS.orange, backgroundColor: COLORS.orangeLight },
    featureTabText: { fontSize: 11, fontWeight: '700', color: COLORS.brown, letterSpacing: -0.2, textAlign: 'center' },
    featureTabTextActive: { color: COLORS.orange },

    // Quick Actions
    quickActionsGrid: { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'space-between', gap: 6, marginBottom: 24 },
    quickAction: { width: (width - 36 - 18) / 4, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, gap: 4, alignItems: 'center' },
    quickActionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    quickActionLabel: { fontSize: 10.5, fontWeight: '700', color: COLORS.brown, letterSpacing: -0.2, textAlign: 'center' },
    quickActionSub: { fontSize: 9, fontWeight: '500', color: COLORS.muted, textAlign: 'center' },

    // Nodes
    nodesCard: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 18, overflow: 'hidden', marginBottom: 32 },
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

    // Contacts
    contactsCard: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 18, overflow: 'hidden', marginBottom: 32 },
    contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
    contactLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    contactAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.greenLight },
    contactAvatarText: { fontSize: 12, fontWeight: '800', color: COLORS.green },
    contactName: { fontSize: 13, fontWeight: '700', color: COLORS.brown, letterSpacing: -0.2 },
    contactMeta: { fontSize: 11, fontWeight: '500', color: COLORS.muted },
    contactRight: { alignItems: 'flex-end', gap: 6 },
    contactPhone: { fontSize: 11, fontWeight: '600', color: COLORS.brownMid },
    contactAction: { backgroundColor: COLORS.orangeLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    contactActionText: { fontSize: 10, fontWeight: '700', color: COLORS.orange },

    // Alerts
    alertCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderLeftWidth: 3, borderRadius: 12, padding: 12, marginBottom: 8 },
    alertIcon: { marginTop: 1 },
    alertContent: { flex: 1 },
    alertTitle: { fontSize: 13, fontWeight: '700', color: COLORS.brown, letterSpacing: -0.2, marginBottom: 2 },
    alertMessage: { fontSize: 11, fontWeight: '500', color: COLORS.brownMid, lineHeight: 16 },
    alertTime: { fontSize: 10, fontWeight: '500', color: COLORS.muted, marginTop: 1 },

    // Empty contacts card
    emptyContactsCard: {
        backgroundColor: COLORS.cardBg, borderWidth: 1.5, borderColor: COLORS.cardBorder,
        borderRadius: 16, paddingVertical: 28, alignItems: 'center', marginBottom: 24,
    },
    emptyContactsEmoji: { fontSize: 36, marginBottom: 10 },
    emptyContactsTitle: {
        fontSize: 15, fontWeight: '800', color: COLORS.brown, letterSpacing: -0.3, marginBottom: 4,
    },
    emptyContactsSub: {
        fontSize: 12, fontWeight: '500', color: COLORS.muted,
    },

    // Bottom Nav
    bottomNav: { flexDirection: 'row', backgroundColor: COLORS.navBg, borderTopWidth: 1, borderTopColor: COLORS.navBorder, paddingBottom: 8, paddingTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
    navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4, position: 'relative' },
    navLabel: { fontSize: 10, fontWeight: '600', color: COLORS.muted, letterSpacing: 0.1 },
    navLabelActive: { color: COLORS.orange },
    navActiveDot: { position: 'absolute', bottom: -4, width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.orange },
});

export default HomeScreen;

