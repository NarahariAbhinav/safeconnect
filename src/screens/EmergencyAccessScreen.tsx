import React, { useEffect } from 'react';
import {
    Linking,
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
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

// Dimensions available if needed for future layout calculations

// ─── Design Tokens ──────────────────────────────────────────────────
const COLORS = {
    bg: '#FFF5F5',
    red: '#D32F2F',
    redLight: '#FF5252',
    redGlow: 'rgba(211,47,47,0.18)',
    redBg: 'rgba(211,47,47,0.08)',
    orange: '#E05A2B',
    brown: '#2C1A0E',
    brownMid: '#5C3D25',
    green: '#2A7A5A',
    greenBg: 'rgba(42,122,90,0.10)',
    muted: '#8C7060',
    white: '#FFFFFF',
    cardBg: 'rgba(255,255,255,0.92)',
    cardBorder: 'rgba(211,47,47,0.12)',
    blueBg: 'rgba(25,118,210,0.09)',
    blue: '#1976D2',
    amber: '#F57C00',
    amberBg: 'rgba(245,124,0,0.09)',
};

// ─── Logo Icon ─────────────────────────────────────────────────────
const LogoIcon: React.FC = () => (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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

// ─── SOS Icon ──────────────────────────────────────────────────────
const SOSIcon: React.FC<{ size?: number; color?: string }> = ({ size = 32, color = 'white' }) => (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <Circle cx="16" cy="16" r="14" stroke={color} strokeWidth="2" fill="none" opacity="0.3" />
        <Path d="M9 12c0-2.2 1.8-4 4-4h6c2.2 0 4 1.8 4 4v1c0 1.5-0.8 2.8-2 3.5L16 20l-5-3.5C9.8 15.8 9 14.5 9 13v-1z" stroke={color} strokeWidth="2" fill="none" />
        <Circle cx="16" cy="24" r="1.5" fill={color} />
    </Svg>
);

// ─── Phone Icon ────────────────────────────────────────────────────
const PhoneIcon: React.FC<{ color?: string }> = ({ color = COLORS.white }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill={color} />
    </Svg>
);

// ─── Hospital Icon ─────────────────────────────────────────────────
const HospitalIcon: React.FC<{ color?: string }> = ({ color = COLORS.blue }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="1.8" fill="none" />
        <Line x1="12" y1="8" x2="12" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Line x1="8" y1="12" x2="16" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
);

// ─── Police Icon ───────────────────────────────────────────────────
const PoliceIcon: React.FC<{ color?: string }> = ({ color = COLORS.blue }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Path d="M12 2L4 6v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V6L12 2z" stroke={color} strokeWidth="1.8" fill="none" />
        <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

// ─── Fire Icon ─────────────────────────────────────────────────────
const FireIcon: React.FC<{ color?: string }> = ({ color = COLORS.amber }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Path d="M12 2c0 0-4 4-4 9a4 4 0 008 0c0-2-1-3.5-1-3.5S14 9 14 11a2 2 0 01-4 0c0-3 2-9 2-9z" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <Path d="M8 20c0 0 1-2 4-2s4 2 4 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
);

// ─── Ambulance Icon ────────────────────────────────────────────────
const AmbulanceIcon: React.FC<{ color?: string }> = ({ color = COLORS.red }) => (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <Rect x="1" y="8" width="15" height="10" rx="1.5" stroke={color} strokeWidth="1.8" fill="none" />
        <Path d="M16 12l4 2v4h-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="5.5" cy="18.5" r="1.5" stroke={color} strokeWidth="1.5" fill="none" />
        <Circle cx="18.5" cy="18.5" r="1.5" stroke={color} strokeWidth="1.5" fill="none" />
        <Line x1="6" y1="11" x2="6" y2="15" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <Line x1="4" y1="13" x2="8" y2="13" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
);

// ─── Info Icon ─────────────────────────────────────────────────────
const InfoIcon: React.FC<{ color?: string }> = ({ color = COLORS.amber }) => (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" fill="none" />
        <Line x1="12" y1="8" x2="12" y2="8.5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <Line x1="12" y1="12" x2="12" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
);

// ─── Pulsing SOS Ring (reanimated — New Arch safe) ─────────────────
const PulsingRing: React.FC = () => {
    const pulse1 = useSharedValue(0);
    const pulse2 = useSharedValue(0);

    useEffect(() => {
        const loop = (val: SharedValue<number>, delay: number) => {
            val.value = withDelay(
                delay,
                withRepeat(
                    withSequence(
                        withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
                        withTiming(0, { duration: 0 }),
                    ),
                    -1,
                    false
                )
            );
        };
        loop(pulse1, 0);
        loop(pulse2, 900);
    }, []);

    const ring1Style = useAnimatedStyle(() => ({
        opacity: 0.6 - pulse1.value * 0.6,
        transform: [{ scale: 1 + pulse1.value * 0.7 }],
    }));

    const ring2Style = useAnimatedStyle(() => ({
        opacity: 0.6 - pulse2.value * 0.6,
        transform: [{ scale: 1 + pulse2.value * 0.7 }],
    }));

    return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[styles.pulsingRing, ring1Style]} />
            <Animated.View style={[styles.pulsingRing, ring2Style]} />
        </View>
    );
};

// ─── Emergency Service Card ────────────────────────────────────────
interface ServiceCardProps {
    icon: React.ReactNode;
    title: string;
    number: string;
    subtitle: string;
    bgColor: string;
    borderColor: string;
    onPress: () => void;
    delay: number;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
    icon, title, number, subtitle, bgColor, borderColor, onPress, delay,
}) => (
    <Animated.View entering={FadeInUp.duration(500).delay(delay)}>
        <TouchableOpacity
            style={[styles.serviceCard, { backgroundColor: bgColor, borderColor }]}
            onPress={onPress}
            activeOpacity={0.75}
        >
            <View style={[styles.serviceIconWrap, { backgroundColor: borderColor + '33' }]}>
                {icon}
            </View>
            <View style={styles.serviceInfo}>
                <Text style={styles.serviceTitle}>{title}</Text>
                <Text style={styles.serviceNumber}>{number}</Text>
                <Text style={styles.serviceSubtitle}>{subtitle}</Text>
            </View>
            <View style={[styles.callBadge, { backgroundColor: borderColor }]}>
                <PhoneIcon color={COLORS.white} />
            </View>
        </TouchableOpacity>
    </Animated.View>
);

// ─── Safety Tip Card ───────────────────────────────────────────────
const SafetyTip: React.FC<{ tip: string; index: number; delay: number }> = ({ tip, index, delay }) => (
    <Animated.View entering={FadeInUp.duration(500).delay(delay)}>
        <View style={styles.tipCard}>
            <View style={styles.tipNumber}>
                <Text style={styles.tipNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.tipText}>{tip}</Text>
        </View>
    </Animated.View>
);

// ─── Main Screen ──────────────────────────────────────────────────────
interface Props {
    navigation: any;
}

const EmergencyAccessScreen: React.FC<Props> = ({ navigation }) => {
    const sosScale = useSharedValue(1);

    const sosAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: sosScale.value }],
    }));

    const handleSOSPress = () => {
        sosScale.value = withSequence(
            withTiming(0.92, { duration: 100 }),
            withSpring(1.05, { damping: 5, stiffness: 200 }),
            withTiming(1, { duration: 100 }),
        );
        Linking.openURL('tel:112');
    };

    const emergencyServices = [
        {
            icon: <AmbulanceIcon color={COLORS.red} />,
            title: 'Ambulance',
            number: '108',
            subtitle: 'Medical Emergency',
            bgColor: COLORS.redBg,
            borderColor: COLORS.red,
            phone: 'tel:108',
        },
        {
            icon: <PoliceIcon color={COLORS.blue} />,
            title: 'Police',
            number: '100',
            subtitle: 'Law & Order',
            bgColor: COLORS.blueBg,
            borderColor: COLORS.blue,
            phone: 'tel:100',
        },
        {
            icon: <FireIcon color={COLORS.amber} />,
            title: 'Fire Brigade',
            number: '101',
            subtitle: 'Fire Emergency',
            bgColor: COLORS.amberBg,
            borderColor: COLORS.amber,
            phone: 'tel:101',
        },
        {
            icon: <HospitalIcon color={COLORS.green} />,
            title: 'Women Helpline',
            number: '1091',
            subtitle: 'Women Safety',
            bgColor: COLORS.greenBg,
            borderColor: COLORS.green,
            phone: 'tel:1091',
        },
    ];

    const safetyTips = [
        'Stay calm and assess the situation before acting.',
        'Move to a safe, well-lit public area if possible.',
        'Share your live location with a trusted contact.',
        'Make noise to attract attention in dangerous situations.',
        'Trust your instincts — if something feels wrong, leave.',
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* ── Header ── */}
            <Animated.View entering={FadeInDown.duration(500).delay(0)} style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <Path d="M19 12H5M12 5l-7 7 7 7" stroke={COLORS.brown} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <View style={styles.logoBadge}>
                        <LogoIcon />
                    </View>
                    <Text style={styles.appName}>
                        Safe<Text style={styles.appNameAccent}>Connect</Text>
                    </Text>
                </View>
                <View style={styles.emergencyBadge}>
                    <Text style={styles.emergencyBadgeText}>🚨 EMERGENCY</Text>
                </View>
            </Animated.View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.scrollContent}>

                {/* ── Warning Banner ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(100)} style={styles.warningBanner}>
                    <InfoIcon color={COLORS.amber} />
                    <Text style={styles.warningText}>
                        Emergency access — no login required. For full features, please{' '}
                        <Text style={styles.warningLink} onPress={() => navigation.navigate('Login')}>
                            sign in
                        </Text>.
                    </Text>
                </Animated.View>

                {/* ── SOS Button ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(200)} style={styles.sosSection}>
                    <Text style={styles.sosSectionTitle}>Tap for Immediate Help</Text>
                    <View style={styles.sosWrapper}>
                        <PulsingRing />
                        <Animated.View style={[{ position: 'absolute' }, sosAnimStyle]}>
                            <TouchableOpacity
                                style={styles.sosButton}
                                onPress={handleSOSPress}
                                activeOpacity={0.85}
                            >
                                <SOSIcon size={36} color={COLORS.white} />
                                <Text style={styles.sosLabel}>SOS</Text>
                                <Text style={styles.sosSubLabel}>Calls 112</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                    <Text style={styles.sosHint}>Calls national emergency number (112)</Text>
                </Animated.View>

                {/* ── Emergency Services ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Emergency Services</Text>
                    <Text style={styles.sectionSubtitle}>Tap any card to call directly</Text>
                </Animated.View>

                {emergencyServices.map((service, i) => (
                    <ServiceCard
                        key={service.number}
                        icon={service.icon}
                        title={service.title}
                        number={service.number}
                        subtitle={service.subtitle}
                        bgColor={service.bgColor}
                        borderColor={service.borderColor}
                        onPress={() => Linking.openURL(service.phone)}
                        delay={360 + i * 80}
                    />
                ))}

                {/* ── Safety Tips ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(700)} style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Stay Safe</Text>
                    <Text style={styles.sectionSubtitle}>Quick safety reminders</Text>
                </Animated.View>

                {safetyTips.map((tip, i) => (
                    <SafetyTip key={i} tip={tip} index={i} delay={750 + i * 60} />
                ))}

                {/* ── Footer CTA ── */}
                <Animated.View entering={FadeInUp.duration(500).delay(1050)} style={styles.footerCTA}>
                    <Text style={styles.footerCTATitle}>Need full SafeConnect features?</Text>
                    <Text style={styles.footerCTASubtitle}>
                        Login to access mesh networking, live location sharing, and community alerts.
                    </Text>
                    <TouchableOpacity
                        style={styles.loginBtn}
                        onPress={() => navigation.navigate('Login')}
                        activeOpacity={0.82}
                    >
                        <Text style={styles.loginBtnText}>Sign In to SafeConnect</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.signupBtn}
                        onPress={() => navigation.navigate('Signup')}
                        activeOpacity={0.82}
                    >
                        <Text style={styles.signupBtnText}>Create Free Account</Text>
                    </TouchableOpacity>
                </Animated.View>

            </ScrollView>
        </SafeAreaView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },

    // ── Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 10,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: 'rgba(44,26,14,0.07)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    logoBadge: {
        width: 36,
        height: 36,
        backgroundColor: COLORS.orange,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.orange,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    appName: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.brown,
        letterSpacing: -0.2,
    },
    appNameAccent: {
        color: COLORS.orange,
    },
    emergencyBadge: {
        backgroundColor: COLORS.red,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    emergencyBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: COLORS.white,
        letterSpacing: 0.5,
    },

    // ── Scroll
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },

    // ── Warning Banner
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: 'rgba(245,124,0,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(245,124,0,0.25)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '500',
        color: COLORS.brownMid,
        lineHeight: 18,
    },
    warningLink: {
        color: COLORS.orange,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },

    // ── SOS Section
    sosSection: {
        alignItems: 'center',
        marginBottom: 28,
    },
    sosSectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.muted,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 20,
    },
    sosWrapper: {
        width: 140,
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    pulsingRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2,
        borderColor: COLORS.red,
    },
    sosButton: {
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: COLORS.red,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.red,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 12,
        gap: 2,
    },
    sosLabel: {
        fontSize: 26,
        fontWeight: '900',
        color: COLORS.white,
        letterSpacing: 2,
        lineHeight: 28,
    },
    sosSubLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.75)',
        letterSpacing: 0.5,
    },
    sosHint: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.muted,
        letterSpacing: 0.2,
    },

    // ── Section Header
    sectionHeader: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.brown,
        letterSpacing: -0.5,
    },
    sectionSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        color: COLORS.muted,
        marginTop: 2,
    },

    // ── Service Card
    serviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderWidth: 1.5,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
    },
    serviceIconWrap: {
        width: 46,
        height: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceInfo: {
        flex: 1,
    },
    serviceTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.brown,
        letterSpacing: -0.2,
    },
    serviceNumber: {
        fontSize: 22,
        fontWeight: '900',
        color: COLORS.brown,
        letterSpacing: -0.5,
        lineHeight: 26,
    },
    serviceSubtitle: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.muted,
    },
    callBadge: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Safety Tips
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: COLORS.cardBg,
        borderWidth: 1,
        borderColor: 'rgba(44,26,14,0.08)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    tipNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.orange,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    tipNumberText: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.white,
    },
    tipText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: COLORS.brownMid,
        lineHeight: 19,
    },

    // ── Footer CTA
    footerCTA: {
        marginTop: 24,
        backgroundColor: COLORS.cardBg,
        borderWidth: 1.5,
        borderColor: 'rgba(224,90,43,0.18)',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
    },
    footerCTATitle: {
        fontSize: 17,
        fontWeight: '800',
        color: COLORS.brown,
        letterSpacing: -0.4,
        textAlign: 'center',
        marginBottom: 6,
    },
    footerCTASubtitle: {
        fontSize: 12,
        fontWeight: '500',
        color: COLORS.muted,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 18,
    },
    loginBtn: {
        width: '100%',
        backgroundColor: COLORS.orange,
        borderRadius: 100,
        paddingVertical: 15,
        alignItems: 'center',
        marginBottom: 10,
        shadowColor: COLORS.orange,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    loginBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.white,
        letterSpacing: 0.2,
    },
    signupBtn: {
        width: '100%',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: 'rgba(44,26,14,0.18)',
        borderRadius: 100,
        paddingVertical: 13,
        alignItems: 'center',
    },
    signupBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.brownMid,
        letterSpacing: 0.1,
    },
});

export default EmergencyAccessScreen;
