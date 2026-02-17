import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    StyleSheet,
    TouchableOpacity,
    View,
    TextInput,
    ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
    Circle,
    Defs,
    Line,
    Path,
    RadialGradient,
    Rect,
    Stop
} from 'react-native-svg';

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
  inputBg:    'rgba(255,255,255,0.85)',
  inputBorder:'rgba(44,26,14,0.15)',
  error:      '#D32F2F',
};

// ─── Logo Icon ─────────────────────────────────────────────────────
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

// ─── Lock Icon ─────────────────────────────────────────────────────
const LockIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <Path d="M4 8v-1.5A6 6 0 0116 6.5V8M4 8h12v8H4v-8z" stroke={COLORS.brownMid} strokeWidth="1.3" fill="none" strokeLinecap="round" />
    <Circle cx="10" cy="12" r="1.5" fill={COLORS.brownMid} />
  </Svg>
);

// ─── Mail Icon ─────────────────────────────────────────────────────
const MailIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <Rect x="2" y="4" width="16" height="12" rx="2" stroke={COLORS.brownMid} strokeWidth="1.3" fill="none" />
    <Path d="M2 4l8 6 8-6" stroke={COLORS.brownMid} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Eye Icon ─────────────────────────────────────────────────────
const EyeIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <Path d="M10 4c-4 0-7.5 2.5-9 6.5C2.5 15 6 17.5 10 17.5s7.5-2.5 9-7-5-6.5-9-6.5z" stroke={COLORS.muted} strokeWidth="1.2" fill="none" />
    <Circle cx="10" cy="10.5" r="2.5" stroke={COLORS.muted} strokeWidth="1.2" fill="none" />
  </Svg>
);

// ─── Main Screen ──────────────────────────────────────────────────────
interface Props {
  navigation: any;
}

const API_URL = 'http://10.180.135.93:5000/api/auth';

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Staggered entrance animations
  const animHeader    = useRef(new Animated.Value(0)).current;
  const animTitle     = useRef(new Animated.Value(0)).current;
  const animSubtitle  = useRef(new Animated.Value(0)).current;
  const animEmailForm = useRef(new Animated.Value(0)).current;
  const animPassForm  = useRef(new Animated.Value(0)).current;
  const animForgot    = useRef(new Animated.Value(0)).current;
  const animCTA       = useRef(new Animated.Value(0)).current;
  const animSignup    = useRef(new Animated.Value(0)).current;

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
      makeAnim(animHeader,    0),
      makeAnim(animTitle,     80),
      makeAnim(animSubtitle,  160),
      makeAnim(animEmailForm, 240),
      makeAnim(animPassForm,  320),
      makeAnim(animForgot,    400),
      makeAnim(animCTA,       480),
      makeAnim(animSignup,    560),
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

  const handleLogin = async () => {
    setError('');
    setSuccess(false);

    // Validate inputs
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed. Please try again.');
        return;
      }

      // Store token in AsyncStorage (you'll need to set this up)
      setSuccess(true);
      console.log('Login successful:', data);

      // Clear form
      setEmail('');
      setPassword('');

      // Navigate to welcome screen after a short delay
      setTimeout(() => {
        navigation.replace('Welcome', { user: data.user });
      }, 1500);
    } catch (err) {
      setError('Network error. Please check your connection and backend server.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

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

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
        {/* ── Title ── */}
        <Animated.View style={[styles.titleBlock, fadeSlideUp(animTitle)]}>
          <Text style={styles.title}>Welcome Back</Text>
        </Animated.View>

        {/* ── Subtitle ── */}
        <Animated.View style={[styles.subtitleBlock, fadeSlideUp(animSubtitle)]}>
          <Text style={styles.subtitle}>Sign in to your SafeConnect account</Text>
        </Animated.View>

        {/* ── Email Input ── */}
        <Animated.View style={[styles.formGroup, fadeSlideUp(animEmailForm)]}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrapper}>
            <MailIcon />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              editable={!loading}
            />
          </View>
        </Animated.View>

        {/* ── Password Input ── */}
        <Animated.View style={[styles.formGroup, fadeSlideUp(animPassForm)]}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <LockIcon />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={loading}>
              <EyeIcon />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Error Message ── */}
        {error ? (
          <Animated.View style={[styles.errorBlock, fadeSlideUp(animForgot)]}>
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        ) : null}

        {/* ── Success Message ── */}
        {success ? (
          <Animated.View style={[styles.successBlock, fadeSlideUp(animForgot)]}>
            <Text style={styles.successText}>✓ Login successful! Redirecting...</Text>
          </Animated.View>
        ) : null}

        {/* ── Forgot Password ── */}
        {!success && (
          <Animated.View style={[styles.forgotBlock, fadeSlideUp(animForgot)]}>
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} disabled={loading}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Login Button ── */}
        <Animated.View style={[styles.ctaRow, fadeSlideUp(animCTA)]}>
          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            activeOpacity={0.82}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.btnPrimaryText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Signup Link ── */}
        <Animated.View style={[styles.signupBlock, fadeSlideUp(animSignup)]}>
          <Text style={styles.signupText}>
            Don't have an account?{' '}
            <Text 
              style={styles.signupLink}
              onPress={() => navigation.navigate('Signup')}
            >
              Create one
            </Text>
          </Text>
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
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
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

  // ── Scroll Content
  scrollContent: {
    flex: 1,
    paddingHorizontal: 18,
  },

  // ── Title
  titleBlock: {
    marginTop: 16,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'serif',
    fontSize: 40,
    fontWeight: '900',
    lineHeight: 44,
    color: COLORS.brown,
    letterSpacing: -1.5,
  },

  // ── Subtitle
  subtitleBlock: {
    marginBottom: 28,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.muted,
    lineHeight: 20,
    letterSpacing: 0.2,
  },

  // ── Form Group
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.brown,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.brown,
    padding: 0,
  },

  // ── Forgot Password
  forgotBlock: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.orange,
    letterSpacing: 0.2,
  },

  // ── CTA Button
  ctaRow: {
    width: '100%',
    marginBottom: 20,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    borderRadius: 100,
    paddingVertical: 16,
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

  // ── Signup Link
  signupBlock: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  signupText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.brownMid,
    letterSpacing: 0.1,
  },
  signupLink: {
    color: COLORS.orange,
    fontWeight: '700',
  },

  // Error message
  errorBlock: {
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.error,
    letterSpacing: 0.1,
  },

  // Success message
  successBlock: {
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(42, 122, 90, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.green,
    borderRadius: 8,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.green,
    letterSpacing: 0.1,
  },

  // Disabled button
  btnDisabled: {
    opacity: 0.6,
  },
});

export default LoginScreen;
