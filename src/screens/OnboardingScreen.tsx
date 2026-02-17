import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
    Circle,
    Defs,
    G,
    Line,
    Path,
    RadialGradient,
    Rect,
    Stop
} from 'react-native-svg';

// ─── If you're using expo-font, load these in your app entry:
// useFonts({ 'PlayfairDisplay-BlackItalic': require('./assets/fonts/PlayfairDisplay-BlackItalic.ttf') })
// For a quick drop-in, the styles fall back to a serif system font gracefully.

const { width } = Dimensions.get('window');

// ─── Design Tokens ──────────────────────────────────────────────────
const COLORS = {
  bg:         '#EBF4F7',
  orange:     '#E05A2B',
  orangeGlow: 'rgba(224,90,43,0.18)',
  brown:      '#2C1A0E',
  brownMid:   '#5C3D25',
  green:      '#2A7A5A',
  muted:      '#8C7060',
  white:      '#FFFFFF',
  pillBg:     'rgba(255,255,255,0.70)',
  pillBorder: 'rgba(44,26,14,0.10)',
  greenBadge: 'rgba(42,122,90,0.12)',
  greenBorder:'rgba(42,122,90,0.25)',
};

// ─── Animated SVG helpers ────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle as any);
const AnimatedG = Animated.createAnimatedComponent(G as any);

// ─── Mesh Illustration ───────────────────────────────────────────────
const MeshIllustration: React.FC = () => {
  // Float animations for each node
  const makeFloat = (duration: number, delay: number) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, []);
    return anim;
  };

  // Pulse ring animation
  const makePulse = (delay: number) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false, // r/opacity are not native-driver compatible
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: false }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, []);
    return anim;
  };

  // Data packet travel animation (0→1 along line)
  const makePacket = (duration: number, delay: number) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: false }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, []);
    return anim;
  };

  const floatCenter = makeFloat(3000, 0);
  const floatTL     = makeFloat(3400, 500);
  const floatTR     = makeFloat(3200, 1000);
  const floatBL     = makeFloat(2800, 300);
  const floatBR     = makeFloat(3600, 700);

  const pulse1 = makePulse(0);
  const pulse2 = makePulse(800);

  const packet1 = makePacket(2800, 0);
  const packet2 = makePacket(3200, 500);

  const toTranslateY = (anim: Animated.Value, range = 6) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [0, -range] });

  // Pulse ring: radius 32→70, opacity 0.5→0
  const pulseR1 = pulse1.interpolate({ inputRange: [0, 1], outputRange: [32, 70] });
  const pulseO1 = pulse1.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const pulseR2 = pulse2.interpolate({ inputRange: [0, 1], outputRange: [32, 70] });
  const pulseO2 = pulse2.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] });

  // Packet 1: center(170,115) → TL(80,58)
  const pkt1x = packet1.interpolate({ inputRange: [0, 1], outputRange: [170, 80] });
  const pkt1y = packet1.interpolate({ inputRange: [0, 1], outputRange: [115, 58] });
  // Packet 2: center(170,115) → TR(268,55)
  const pkt2x = packet2.interpolate({ inputRange: [0, 1], outputRange: [170, 268] });
  const pkt2y = packet2.interpolate({ inputRange: [0, 1], outputRange: [115, 55] });

  const SVG_W = Math.min(width - 20, 340);
  const scale = SVG_W / 340;

  return (
    <View style={styles.illustrationWrap}>
      <Svg width={SVG_W} height={230 * scale} viewBox="0 0 340 230">
        <Defs>
          <RadialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFF8F3" />
            <Stop offset="100%" stopColor="#F5EDE0" />
          </RadialGradient>
          <RadialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFEEE6" />
            <Stop offset="100%" stopColor="#FAE0D0" />
          </RadialGradient>
        </Defs>

        {/* ── Connection Lines ── */}
        <Line x1="170" y1="115" x2="80"  y2="58"  stroke={COLORS.orange} strokeWidth="1.5" strokeOpacity="0.30" strokeDasharray="8 5" />
        <Line x1="170" y1="115" x2="268" y2="55"  stroke={COLORS.orange} strokeWidth="1.5" strokeOpacity="0.30" strokeDasharray="8 5" />
        <Line x1="170" y1="115" x2="68"  y2="178" stroke={COLORS.orange} strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="8 5" />
        <Line x1="170" y1="115" x2="272" y2="180" stroke={COLORS.orange} strokeWidth="1.5" strokeOpacity="0.25" strokeDasharray="8 5" />
        <Line x1="80"  y1="58"  x2="268" y2="55"  stroke={COLORS.green}  strokeWidth="1"   strokeOpacity="0.20" strokeDasharray="4 6" />
        <Line x1="68"  y1="178" x2="272" y2="180" stroke={COLORS.green}  strokeWidth="1"   strokeOpacity="0.20" strokeDasharray="4 6" />
        {/* Satellite */}
        <Line x1="268" y1="55"  x2="320" y2="88"  stroke={COLORS.orange} strokeWidth="1"   strokeOpacity="0.15" strokeDasharray="3 5" />

        {/* ── Pulse Rings on Center ── */}
        <AnimatedCircle cx={170} cy={115} r={pulseR1 as any} fill="none" stroke={COLORS.orange} strokeWidth="1.2" strokeOpacity={pulseO1 as any} />
        <AnimatedCircle cx={170} cy={115} r={pulseR2 as any} fill="none" stroke={COLORS.orange} strokeWidth="0.8" strokeOpacity={pulseO2 as any} />

        {/* ── Satellite Node ── */}
        <AnimatedG style={{ transform: [{ translateY: toTranslateY(floatTR) }] }}>
          <Circle cx="320" cy="88" r="10" fill="url(#nodeGrad)" stroke={COLORS.orange} strokeWidth="1.2" strokeOpacity="0.4" />
          <Circle cx="320" cy="88" r="3.5" fill={COLORS.orange} opacity="0.45" />
        </AnimatedG>

        {/* ── Top-Left Node (phone icon) ── */}
        <AnimatedG style={{ transform: [{ translateY: toTranslateY(floatTL) }] }}>
          <Circle cx="80" cy="58" r="26" fill="url(#nodeGrad)" stroke={COLORS.orange} strokeWidth="1.8" />
          <Rect x="71" y="50" width="18" height="16" rx="3" fill={COLORS.orange} opacity="0.2" />
          <Rect x="73.5" y="52.5" width="13" height="11" rx="1.5" fill={COLORS.white} opacity="0.8" />
          <Circle cx="80" cy="63" r="1.5" fill={COLORS.orange} opacity="0.6" />
        </AnimatedG>

        {/* ── Top-Right Node (wifi icon) ── */}
        <AnimatedG style={{ transform: [{ translateY: toTranslateY(floatTR) }] }}>
          <Circle cx="268" cy="55" r="22" fill="url(#nodeGrad)" stroke={COLORS.green} strokeWidth="1.5" />
          <Circle cx="268" cy="62" r="2.5" fill={COLORS.green} />
          <Path d="M262 56a8.5 8.5 0 0112 0"  stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
          <Path d="M264.5 58.5a5 5 0 017 0"   stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.75" />
        </AnimatedG>

        {/* ── Center / Main Node (mesh link icon) ── */}
        <AnimatedG style={{ transform: [{ translateY: toTranslateY(floatCenter) }] }}>
          <Circle cx="170" cy="115" r="36" fill="url(#centerGrad)" stroke={COLORS.orange} strokeWidth="2.5" />
          <Circle cx="163" cy="110" r="5"  fill="none" stroke={COLORS.orange} strokeWidth="2" />
          <Circle cx="177" cy="110" r="5"  fill="none" stroke={COLORS.orange} strokeWidth="2" />
          <Circle cx="170" cy="122" r="5"  fill="none" stroke={COLORS.orange} strokeWidth="2" />
          <Line x1="163" y1="115" x2="165" y2="117" stroke={COLORS.orange} strokeWidth="2" strokeLinecap="round" />
          <Line x1="177" y1="115" x2="175" y2="117" stroke={COLORS.orange} strokeWidth="2" strokeLinecap="round" />
        </AnimatedG>

        {/* ── Bottom-Left Node (person icon) ── */}
        <AnimatedG style={{ transform: [{ translateY: toTranslateY(floatBL) }] }}>
          <Circle cx="68" cy="178" r="20" fill="url(#nodeGrad)" stroke={COLORS.green} strokeWidth="1.5" />
          <Circle cx="68" cy="171" r="5"  fill={COLORS.green} opacity="0.5" />
          <Path d="M58 185c0-5.5 4.5-10 10-10s10 4.5 10 10" fill={COLORS.green} opacity="0.35" />
        </AnimatedG>

        {/* ── Bottom-Right Node (signal bars) ── */}
        <AnimatedG style={{ transform: [{ translateY: toTranslateY(floatBR) }] }}>
          <Circle cx="272" cy="180" r="22" fill="url(#nodeGrad)" stroke={COLORS.orange} strokeWidth="1.5" />
          <Rect x="263" y="178" width="4" height="6"  rx="1" fill={COLORS.orange} opacity="0.5" />
          <Rect x="269" y="174" width="4" height="10" rx="1" fill={COLORS.orange} opacity="0.65" />
          <Rect x="275" y="170" width="4" height="14" rx="1" fill={COLORS.orange} opacity="0.85" />
        </AnimatedG>

        {/* ── Animated Data Packets ── */}
        <AnimatedCircle cx={pkt1x as any} cy={pkt1y as any} r={4} fill={COLORS.orange} opacity="0.6" />
        <AnimatedCircle cx={pkt2x as any} cy={pkt2y as any} r={3} fill={COLORS.green}  opacity="0.55" />
      </Svg>
    </View>
  );
};

// ─── Logo Badge Icon ─────────────────────────────────────────────────
const LogoIcon: React.FC = () => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <Circle cx="5"  cy="12" r="2.5" fill="white" />
    <Circle cx="12" cy="5"  r="2.5" fill="white" opacity="0.85" />
    <Circle cx="19" cy="12" r="2.5" fill="white" opacity="0.85" />
    <Circle cx="12" cy="19" r="2.5" fill="white" opacity="0.75" />
    <Line x1="7.2"  y1="10.5" x2="10"   y2="7"    stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <Line x1="14"   y1="7"    x2="16.8" y2="10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <Line x1="7.2"  y1="13.5" x2="10"   y2="17"   stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <Line x1="14"   y1="17"   x2="16.8" y2="13.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
  </Svg>
);

// ─── Link / Mesh CTA Icon ─────────────────────────────────────────────
const LinkIcon: React.FC = () => (
  <Svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <Circle cx="6"  cy="10" r="2.5" stroke="white" strokeWidth="1.6" />
    <Circle cx="14" cy="10" r="2.5" stroke="white" strokeWidth="1.6" />
    <Line x1="8.5" y1="10" x2="11.5" y2="10" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

// ─── Play Icon ───────────────────────────────────────────────────────
const PlayIcon: React.FC = () => (
  <Svg width="12" height="14" viewBox="0 0 14 16" fill="none">
    <Path d="M2 1.5l10 6.5-10 6.5V1.5z" fill="none" stroke={COLORS.brown} strokeWidth="1.6" strokeLinejoin="round" />
  </Svg>
);

// ─── Badge Dot with Pulse ─────────────────────────────────────────────
const PulseDot: React.FC = () => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const shadowRadius = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 7] });
  const shadowOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.1] });

  return (
    <Animated.View
      style={[
        styles.badgeDot,
        {
          shadowColor: COLORS.green,
          shadowRadius,
          shadowOpacity,
          elevation: 3,
        },
      ]}
    />
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

// ─── Shield Icon ─────────────────────────────────────────────────────
const ShieldCheckIcon: React.FC = () => (
  <Svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <Path d="M7 1L1 4v3c0 3.3 2.6 6.3 6 7 3.4-.7 6-3.7 6-7V4L7 1z" stroke={COLORS.brownMid} strokeWidth="1.3" fill="none" />
    <Path d="M5 7l1.5 1.5L9.5 5.5" stroke={COLORS.brownMid} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Globe/Range Icon ─────────────────────────────────────────────────
const RangeIcon: React.FC = () => (
  <Svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <Circle cx="7" cy="7" r="5.5" stroke={COLORS.brownMid} strokeWidth="1.3" />
    <Line x1="4" y1="7" x2="10" y2="7" stroke={COLORS.brownMid} strokeWidth="1.3" strokeLinecap="round" />
    <Line x1="7" y1="4" x2="7"  y2="10" stroke={COLORS.brownMid} strokeWidth="1.3" strokeLinecap="round" />
  </Svg>
);

// ─── Mesh Mini Icon ───────────────────────────────────────────────────
const MeshMiniIcon: React.FC = () => (
  <Svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <Circle cx="3"  cy="7"  r="2" stroke={COLORS.brownMid} strokeWidth="1.2" />
    <Circle cx="11" cy="7"  r="2" stroke={COLORS.brownMid} strokeWidth="1.2" />
    <Circle cx="7"  cy="3"  r="2" stroke={COLORS.brownMid} strokeWidth="1.2" />
    <Line x1="5" y1="7"  x2="9"   y2="7"  stroke={COLORS.brownMid} strokeWidth="1.2" strokeLinecap="round" />
    <Line x1="7" y1="5"  x2="5.5" y2="6"  stroke={COLORS.brownMid} strokeWidth="1.2" strokeLinecap="round" />
    <Line x1="7" y1="5"  x2="8.5" y2="6"  stroke={COLORS.brownMid} strokeWidth="1.2" strokeLinecap="round" />
  </Svg>
);

// ─── Main Screen ──────────────────────────────────────────────────────
interface Props {
  navigation: any;
}

const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  // Staggered entrance animations
  const animHeader    = useRef(new Animated.Value(0)).current;
  const animIllus     = useRef(new Animated.Value(0)).current;
  const animBadge     = useRef(new Animated.Value(0)).current;
  const animHeadline  = useRef(new Animated.Value(0)).current;
  const animSubtext   = useRef(new Animated.Value(0)).current;
  const animFeatures  = useRef(new Animated.Value(0)).current;
  const animCTA       = useRef(new Animated.Value(0)).current;
  const animFooter    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeAnim = (val: Animated.Value, delay: number) =>
      Animated.timing(val, {
        toValue: 1,
        duration: 600,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    Animated.stagger(80, [
      makeAnim(animHeader,   0),
      makeAnim(animIllus,    80),
      makeAnim(animBadge,    160),
      makeAnim(animHeadline, 240),
      makeAnim(animSubtext,  320),
      makeAnim(animFeatures, 400),
      makeAnim(animCTA,      480),
      makeAnim(animFooter,   560),
    ]).start();
  }, []);

  const fadeSlideUp = (anim: Animated.Value, fromY = 20) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [fromY, 0],
        }),
      },
    ],
  });

  const fadeSlideDown = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-16, 0],
        }),
      },
    ],
  });

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <Animated.View style={[styles.header, fadeSlideDown(animHeader)]}>
        <View style={styles.logoBadge}>
          <LogoIcon />
        </View>
        <Text style={styles.appName}>
          Safe<Text style={styles.appNameAccent}>Connect</Text>
        </Text>
      </Animated.View>

      {/* ── Illustration ── */}
      <Animated.View style={fadeSlideUp(animIllus, 12)}>
        <MeshIllustration />
      </Animated.View>

      {/* ── Content ── */}
      <View style={styles.content}>

        {/* Headline */}
        <Animated.View style={[styles.headlineBlock, fadeSlideUp(animHeadline)]}>
          <Text style={styles.headline}>
            Stronger <Text style={styles.headlineAccent}>Together</Text>
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={[styles.subtitleBlock, fadeSlideUp(animSubtext)]}>
          <Text style={styles.subtitle}>
            Stay connected when it matters most
          </Text>
        </Animated.View>

        {/* CTA Button */}
        <Animated.View style={[styles.ctaRow, fadeSlideUp(animCTA)]}>
          <TouchableOpacity
            style={styles.btnPrimary}
            activeOpacity={0.82}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.btnPrimaryText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>

      {/* ── Footer Pagination ── */}
      <Animated.View style={[styles.footerNav, fadeSlideUp(animFooter)]}>
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
    height: 280,
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
    shadowOffset: { width: 0, height: 0 },
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
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(44,26,14,0.15)',
    borderRadius: 100,
    paddingVertical: 14,
  },
  btnSecondaryText: {
    color: COLORS.brown,
    fontSize: 14,
    fontWeight: '600',
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