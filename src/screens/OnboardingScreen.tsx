/**
 * OnboardingScreen — fully rewritten with react-native-reanimated
 *
 * WHY: RN 0.81 + New Architecture (newArchEnabled:true) + React 19 causes
 * the old Animated API to freeze/seal Animated.Value objects. When
 * navigation fires mid-animation, the Animated system tries to add
 * a '_tracking' property to the frozen object → TypeError crash.
 *
 * react-native-reanimated runs on the UI thread via JSI and is fully
 * New Architecture compatible — no crash on navigation.
 *
 * SVG FIX: Each node SVG now defines its own <Defs> with gradient
 * definitions so `fill="url(#...)"` works correctly. Gradients defined
 * in one <Svg> cannot be referenced from a separate <Svg> component —
 * they are scoped to their own SVG document. This was causing all node
 * circles to render as solid black.
 */
import React, { useEffect } from 'react';
import {
  Dimensions,
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
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

const { width } = Dimensions.get('window');

// ─── Design Tokens ──────────────────────────────────────────────────
const COLORS = {
  bg: '#EBF4F7',
  orange: '#E05A2B',
  orangeGlow: 'rgba(224,90,43,0.18)',
  brown: '#2C1A0E',
  brownMid: '#5C3D25',
  green: '#2A7A5A',
  muted: '#8C7060',
  white: '#FFFFFF',
  pillBg: 'rgba(255,255,255,0.70)',
  pillBorder: 'rgba(44,26,14,0.10)',
  greenBadge: 'rgba(42,122,90,0.12)',
  greenBorder: 'rgba(42,122,90,0.25)',
};

// ─── Floating Node Wrapper ──────────────────────────────────────────
const FloatingNode: React.FC<{
  delay: number;
  duration: number;
  range?: number;
  children: React.ReactNode;
}> = ({ delay, duration, range = 6, children }) => {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-range, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
};

// ─── Mesh Illustration ────────────────────────────────────────────────
// FIX: Each node <Svg> now has its own <Defs> with gradient so
// fill="url(#...)" resolves correctly within that SVG's scope.
const MeshIllustration: React.FC = () => {
  const SVG_W = Math.min(width - 20, 340);
  const scale = SVG_W / 340;

  return (
    <View style={styles.illustrationWrap}>
      {/* Connection lines layer */}
      <Svg width={SVG_W} height={230 * scale} viewBox="0 0 340 230" style={{ position: 'absolute' }}>
        <Line x1="170" y1="115" x2="80" y2="58" stroke={COLORS.orange} strokeWidth="1.5" strokeOpacity="0.30" strokeDasharray="8 5" />
        <Line x1="170" y1="115" x2="268" y2="55" stroke={COLORS.orange} strokeWidth="1.5" strokeOpacity="0.30" strokeDasharray="8 5" />
        <Line x1="170" y1="115" x2="68" y2="178" stroke={COLORS.orange} strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="8 5" />
        <Line x1="170" y1="115" x2="272" y2="180" stroke={COLORS.orange} strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="8 5" />
        <Line x1="80" y1="58" x2="268" y2="55" stroke={COLORS.green} strokeWidth="1" strokeOpacity="0.20" strokeDasharray="4 6" />
        <Line x1="68" y1="178" x2="272" y2="180" stroke={COLORS.green} strokeWidth="1" strokeOpacity="0.20" strokeDasharray="4 6" />
        <Line x1="268" y1="55" x2="320" y2="88" stroke={COLORS.orange} strokeWidth="1" strokeOpacity="0.15" strokeDasharray="3 5" />
      </Svg>

      {/* Nodes layer — each SVG has its own gradient defs */}
      <View style={[{ width: SVG_W, height: 230 * scale }]}>

        {/* Center node */}
        <FloatingNode delay={0} duration={3000} range={5}>
          <View style={{ position: 'absolute', left: 134 * scale, top: 79 * scale }}>
            <Svg width={72 * scale} height={72 * scale} viewBox="0 0 72 72">
              <Defs>
                <RadialGradient id="cg" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#FFEEE6" />
                  <Stop offset="100%" stopColor="#FAE0D0" />
                </RadialGradient>
              </Defs>
              <Circle cx="36" cy="36" r="36" fill="url(#cg)" stroke={COLORS.orange} strokeWidth="2.5" />
              <Circle cx="29" cy="31" r="5" fill="none" stroke={COLORS.orange} strokeWidth="2" />
              <Circle cx="43" cy="31" r="5" fill="none" stroke={COLORS.orange} strokeWidth="2" />
              <Circle cx="36" cy="43" r="5" fill="none" stroke={COLORS.orange} strokeWidth="2" />
              <Line x1="29" y1="36" x2="31" y2="38" stroke={COLORS.orange} strokeWidth="2" strokeLinecap="round" />
              <Line x1="43" y1="36" x2="41" y2="38" stroke={COLORS.orange} strokeWidth="2" strokeLinecap="round" />
            </Svg>
          </View>
        </FloatingNode>

        {/* Top-left node */}
        <FloatingNode delay={500} duration={3400} range={6}>
          <View style={{ position: 'absolute', left: 54 * scale, top: 32 * scale }}>
            <Svg width={52 * scale} height={52 * scale} viewBox="0 0 52 52">
              <Defs>
                <RadialGradient id="ng1" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#FFF8F3" />
                  <Stop offset="100%" stopColor="#F5EDE0" />
                </RadialGradient>
              </Defs>
              <Circle cx="26" cy="26" r="26" fill="url(#ng1)" stroke={COLORS.orange} strokeWidth="1.8" />
              <Rect x="17" y="18" width="18" height="16" rx="3" fill={COLORS.orange} opacity="0.2" />
              <Rect x="19.5" y="20.5" width="13" height="11" rx="1.5" fill={COLORS.white} opacity="0.8" />
              <Circle cx="26" cy="31" r="1.5" fill={COLORS.orange} opacity="0.6" />
            </Svg>
          </View>
        </FloatingNode>

        {/* Top-right node */}
        <FloatingNode delay={1000} duration={3200} range={7}>
          <View style={{ position: 'absolute', left: 246 * scale, top: 33 * scale }}>
            <Svg width={44 * scale} height={44 * scale} viewBox="0 0 44 44">
              <Defs>
                <RadialGradient id="ng2" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#FFF8F3" />
                  <Stop offset="100%" stopColor="#F5EDE0" />
                </RadialGradient>
              </Defs>
              <Circle cx="22" cy="22" r="22" fill="url(#ng2)" stroke={COLORS.green} strokeWidth="1.5" />
              <Circle cx="22" cy="29" r="2.5" fill={COLORS.green} />
              <Path d="M16 23a8.5 8.5 0 0112 0" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
              <Path d="M18.5 25.5a5 5 0 017 0" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.75" />
            </Svg>
          </View>
        </FloatingNode>

        {/* Bottom-left node */}
        <FloatingNode delay={300} duration={2800} range={5}>
          <View style={{ position: 'absolute', left: 48 * scale, top: 158 * scale }}>
            <Svg width={40 * scale} height={40 * scale} viewBox="0 0 40 40">
              <Defs>
                <RadialGradient id="ng3" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#FFF8F3" />
                  <Stop offset="100%" stopColor="#F5EDE0" />
                </RadialGradient>
              </Defs>
              <Circle cx="20" cy="20" r="20" fill="url(#ng3)" stroke={COLORS.green} strokeWidth="1.5" />
              <Circle cx="20" cy="13" r="5" fill={COLORS.green} opacity="0.5" />
              <Path d="M10 27c0-5.5 4.5-10 10-10s10 4.5 10 10" fill={COLORS.green} opacity="0.35" />
            </Svg>
          </View>
        </FloatingNode>

        {/* Bottom-right node */}
        <FloatingNode delay={700} duration={3600} range={6}>
          <View style={{ position: 'absolute', left: 250 * scale, top: 158 * scale }}>
            <Svg width={44 * scale} height={44 * scale} viewBox="0 0 44 44">
              <Defs>
                <RadialGradient id="ng4" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#FFF8F3" />
                  <Stop offset="100%" stopColor="#F5EDE0" />
                </RadialGradient>
              </Defs>
              <Circle cx="22" cy="22" r="22" fill="url(#ng4)" stroke={COLORS.orange} strokeWidth="1.5" />
              <Rect x="13" y="20" width="4" height="6" rx="1" fill={COLORS.orange} opacity="0.5" />
              <Rect x="19" y="16" width="4" height="10" rx="1" fill={COLORS.orange} opacity="0.65" />
              <Rect x="25" y="12" width="4" height="14" rx="1" fill={COLORS.orange} opacity="0.85" />
            </Svg>
          </View>
        </FloatingNode>

        {/* Satellite node */}
        <FloatingNode delay={200} duration={2600} range={4}>
          <View style={{ position: 'absolute', left: 310 * scale, top: 78 * scale }}>
            <Svg width={20 * scale} height={20 * scale} viewBox="0 0 20 20">
              <Defs>
                <RadialGradient id="ng5" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#FFF8F3" />
                  <Stop offset="100%" stopColor="#F5EDE0" />
                </RadialGradient>
              </Defs>
              <Circle cx="10" cy="10" r="10" fill="url(#ng5)" stroke={COLORS.orange} strokeWidth="1.2" strokeOpacity="0.4" />
              <Circle cx="10" cy="10" r="3.5" fill={COLORS.orange} opacity="0.45" />
            </Svg>
          </View>
        </FloatingNode>
      </View>
    </View>
  );
};

// ─── Logo Icon ────────────────────────────────────────────────────────
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

// ─── Shield Icon ─────────────────────────────────────────────────────
const ShieldCheckIcon: React.FC = () => (
  <Svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <Path d="M7 1L1 4v3c0 3.3 2.6 6.3 6 7 3.4-.7 6-3.7 6-7V4L7 1z" stroke={COLORS.brownMid} strokeWidth="1.3" fill="none" />
    <Path d="M5 7l1.5 1.5L9.5 5.5" stroke={COLORS.brownMid} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const RangeIcon: React.FC = () => (
  <Svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <Circle cx="7" cy="7" r="5.5" stroke={COLORS.brownMid} strokeWidth="1.3" />
    <Line x1="4" y1="7" x2="10" y2="7" stroke={COLORS.brownMid} strokeWidth="1.3" strokeLinecap="round" />
    <Line x1="7" y1="4" x2="7" y2="10" stroke={COLORS.brownMid} strokeWidth="1.3" strokeLinecap="round" />
  </Svg>
);

const MeshMiniIcon: React.FC = () => (
  <Svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <Circle cx="3" cy="7" r="2" stroke={COLORS.brownMid} strokeWidth="1.2" />
    <Circle cx="11" cy="7" r="2" stroke={COLORS.brownMid} strokeWidth="1.2" />
    <Circle cx="7" cy="3" r="2" stroke={COLORS.brownMid} strokeWidth="1.2" />
    <Line x1="5" y1="7" x2="9" y2="7" stroke={COLORS.brownMid} strokeWidth="1.2" strokeLinecap="round" />
    <Line x1="7" y1="5" x2="5.5" y2="6" stroke={COLORS.brownMid} strokeWidth="1.2" strokeLinecap="round" />
    <Line x1="7" y1="5" x2="8.5" y2="6" stroke={COLORS.brownMid} strokeWidth="1.2" strokeLinecap="round" />
  </Svg>
);

// ─── Pulse Dot (reanimated — no crash) ───────────────────────────────
const PulseDot: React.FC = () => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 2 - scale.value,
  }));

  return (
    <Animated.View style={[styles.badgeDot, style]} />
  );
};

// ─── Feature Pill ─────────────────────────────────────────────────────
interface FeaturePillProps { label: string; icon: React.ReactNode; }
const FeaturePill: React.FC<FeaturePillProps> = ({ label, icon }) => (
  <View style={styles.featurePill}>
    {icon}
    <Text style={styles.featurePillText}>{label}</Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────
interface Props {
  navigation: any;
}

const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.duration(500).delay(0)} style={styles.header}>
        <View style={styles.logoBadge}>
          <LogoIcon />
        </View>
        <Text style={styles.appName}>
          Safe<Text style={styles.appNameAccent}>Connect</Text>
        </Text>
      </Animated.View>

      {/* ── Illustration ── */}
      <Animated.View entering={FadeInUp.duration(600).delay(80)}>
        <MeshIllustration />
      </Animated.View>

      {/* ── Content ── */}
      <View style={styles.content}>

        {/* Live badge */}
        <Animated.View entering={FadeInUp.duration(500).delay(200)} style={styles.badge}>
          <PulseDot />
          <Text style={styles.badgeText}>14 Nodes Active Nearby</Text>
        </Animated.View>

        {/* Headline */}
        <Animated.View entering={FadeInUp.duration(500).delay(280)} style={styles.headlineBlock}>
          <Text style={styles.headline}>
            Stronger <Text style={styles.headlineAccent}>Together</Text>
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View entering={FadeInUp.duration(500).delay(360)} style={styles.subtitleBlock}>
          <Text style={styles.subtitle}>
            Stay connected when it matters most
          </Text>
        </Animated.View>

        {/* Feature pills */}
        <Animated.View entering={FadeInUp.duration(500).delay(440)} style={styles.featuresRow}>
          <FeaturePill label="Offline Mesh" icon={<MeshMiniIcon />} />
          <FeaturePill label="5 km Range" icon={<RangeIcon />} />
          <FeaturePill label="Encrypted" icon={<ShieldCheckIcon />} />
        </Animated.View>

        {/* CTA Buttons */}
        <Animated.View entering={FadeInUp.duration(500).delay(520)} style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.btnPrimary}
            activeOpacity={0.82}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.btnPrimaryText}>Get Started</Text>
          </TouchableOpacity>

          {/* Emergency Access — no login required */}
          <TouchableOpacity
            style={styles.btnEmergency}
            activeOpacity={0.80}
            onPress={() => navigation.navigate('EmergencyAccess')}
          >
            <Text style={styles.btnEmergencyIcon}>🚨</Text>
            <Text style={styles.btnEmergencyText}>Emergency Access</Text>
            <Text style={styles.btnEmergencyHint}>No login needed</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>

      {/* ── Footer ── */}
      <Animated.View entering={FadeInUp.duration(500).delay(600)} style={styles.footerNav}>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip intro →</Text>
        </TouchableOpacity>
      </Animated.View>

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
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  logoBadge: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.brown,
    letterSpacing: -0.2,
  },
  appNameAccent: {
    color: COLORS.orange,
  },

  // ── Illustration
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 12,
    height: 230,
  },

  // ── Content
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 12,
    justifyContent: 'center',
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.greenBadge,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    borderRadius: 100,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.green,
    letterSpacing: 0.1,
  },

  // Headline
  headlineBlock: {
    marginBottom: 4,
  },
  headline: {
    fontFamily: 'serif',
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 52,
    color: COLORS.brown,
    letterSpacing: -2,
  },
  headlineAccent: {
    fontFamily: 'serif',
    fontStyle: 'italic',
    color: COLORS.orange,
    fontWeight: '900',
  },

  // Subtitle
  subtitleBlock: {
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.muted,
    lineHeight: 21,
    letterSpacing: 0.3,
  },

  // Feature Pills
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 20,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.pillBg,
    borderWidth: 1,
    borderColor: COLORS.pillBorder,
    borderRadius: 100,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  featurePillText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.brownMid,
  },

  // CTA Buttons
  ctaRow: {
    width: '100%',
    marginBottom: 12,
    gap: 10,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    borderRadius: 100,
    paddingVertical: 18,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  btnPrimaryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnEmergency: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(211,47,47,0.09)',
    borderWidth: 1.5,
    borderColor: 'rgba(211,47,47,0.30)',
    borderRadius: 100,
    paddingVertical: 14,
  },
  btnEmergencyIcon: {
    fontSize: 16,
  },
  btnEmergencyText: {
    color: '#D32F2F',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  btnEmergencyHint: {
    color: 'rgba(211,47,47,0.60)',
    fontSize: 11,
    fontWeight: '500',
  },

  // Footer
  footerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 4,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(44,26,14,0.20)',
  },
  dotActive: {
    width: 22,
    backgroundColor: COLORS.orange,
    borderRadius: 3,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    letterSpacing: 0.1,
  },
});

export default OnboardingScreen;