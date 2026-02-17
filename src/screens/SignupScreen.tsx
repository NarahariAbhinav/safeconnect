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
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
    Circle,
    Line,
    Path,
    Rect,
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
  inputBg:    'rgba(255,255,255,0.85)',
  inputBorder:'rgba(44,26,14,0.15)',
  error:      '#D32F2F',
};

const API_URL = 'http://10.180.135.93:5000/api/auth';

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

// ─── Icons ─────────────────────────────────────────────────────────
const UserIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <Circle cx="10" cy="7" r="4" stroke={COLORS.brownMid} strokeWidth="1.3" fill="none" />
    <Path d="M3 18c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke={COLORS.brownMid} strokeWidth="1.3" strokeLinecap="round" fill="none" />
  </Svg>
);

const MailIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <Rect x="2" y="4" width="16" height="12" rx="2" stroke={COLORS.brownMid} strokeWidth="1.3" fill="none" />
    <Path d="M2 4l8 6 8-6" stroke={COLORS.brownMid} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PhoneIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <Rect x="5" y="1" width="10" height="18" rx="2" stroke={COLORS.brownMid} strokeWidth="1.3" fill="none" />
    <Line x1="8" y1="16" x2="12" y2="16" stroke={COLORS.brownMid} strokeWidth="1.3" strokeLinecap="round" />
  </Svg>
);

const LockIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <Path d="M4 8v-1.5A6 6 0 0116 6.5V8M4 8h12v8H4v-8z" stroke={COLORS.brownMid} strokeWidth="1.3" fill="none" strokeLinecap="round" />
    <Circle cx="10" cy="12" r="1.5" fill={COLORS.brownMid} />
  </Svg>
);

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

const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Staggered entrance animations
  const animHeader      = useRef(new Animated.Value(0)).current;
  const animTitle       = useRef(new Animated.Value(0)).current;
  const animSubtitle    = useRef(new Animated.Value(0)).current;
  const animFirstName   = useRef(new Animated.Value(0)).current;
  const animLastName    = useRef(new Animated.Value(0)).current;
  const animEmail       = useRef(new Animated.Value(0)).current;
  const animPhone       = useRef(new Animated.Value(0)).current;
  const animPassword    = useRef(new Animated.Value(0)).current;
  const animConfirmPass = useRef(new Animated.Value(0)).current;
  const animCTA         = useRef(new Animated.Value(0)).current;
  const animLogin       = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeAnim = (val: Animated.Value, delay: number) =>
      Animated.timing(val, {
        toValue: 1,
        duration: 600,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    Animated.stagger(60, [
      makeAnim(animHeader,      0),
      makeAnim(animTitle,       60),
      makeAnim(animSubtitle,    120),
      makeAnim(animFirstName,   180),
      makeAnim(animLastName,    240),
      makeAnim(animEmail,       300),
      makeAnim(animPhone,       360),
      makeAnim(animPassword,    420),
      makeAnim(animConfirmPass, 480),
      makeAnim(animCTA,         540),
      makeAnim(animLogin,       600),
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

  const handleSignup = async () => {
    setError('');
    setSuccess(false);

    // Validate inputs
    if (!firstName || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        return;
      }

      setSuccess(true);
      console.log('Registration successful:', data);

      // Navigate to Login screen after a short delay
      setTimeout(() => {
        navigation.replace('Login');
      }, 2000);
    } catch (err) {
      setError('Network error. Please check your connection and backend server.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <Animated.View style={[styles.header, fadeSlideDown(animHeader)]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <Path d="M12 4l-6 6 6 6" stroke={COLORS.brown} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.logoBadge}>
          <LogoIcon />
        </View>
        <Text style={styles.appName}>
          Safe<Text style={styles.appNameAccent}>Connect</Text>
        </Text>
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Title ── */}
          <Animated.View style={[styles.titleBlock, fadeSlideUp(animTitle)]}>
            <Text style={styles.title}>Create Account</Text>
          </Animated.View>

          {/* ── Subtitle ── */}
          <Animated.View style={[styles.subtitleBlock, fadeSlideUp(animSubtitle)]}>
            <Text style={styles.subtitle}>Join SafeConnect and stay protected</Text>
          </Animated.View>

          {/* ── Error Message ── */}
          {error ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ── Success Message ── */}
          {success ? (
            <View style={styles.successBlock}>
              <Text style={styles.successText}>✓ Account created! Redirecting to login...</Text>
            </View>
          ) : null}

          {/* ── Name Row ── */}
          <View style={styles.nameRow}>
            {/* First Name */}
            <Animated.View style={[styles.formGroupHalf, fadeSlideUp(animFirstName)]}>
              <Text style={styles.label}>First Name *</Text>
              <View style={styles.inputWrapper}>
                <UserIcon />
                <TextInput
                  style={styles.input}
                  placeholder="First"
                  placeholderTextColor={COLORS.muted}
                  value={firstName}
                  onChangeText={setFirstName}
                  editable={!loading}
                />
              </View>
            </Animated.View>

            {/* Last Name */}
            <Animated.View style={[styles.formGroupHalf, fadeSlideUp(animLastName)]}>
              <Text style={styles.label}>Last Name</Text>
              <View style={styles.inputWrapper}>
                <UserIcon />
                <TextInput
                  style={styles.input}
                  placeholder="Last"
                  placeholderTextColor={COLORS.muted}
                  value={lastName}
                  onChangeText={setLastName}
                  editable={!loading}
                />
              </View>
            </Animated.View>
          </View>

          {/* ── Email Input ── */}
          <Animated.View style={[styles.formGroup, fadeSlideUp(animEmail)]}>
            <Text style={styles.label}>Email Address *</Text>
            <View style={styles.inputWrapper}>
              <MailIcon />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={COLORS.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
          </Animated.View>

          {/* ── Phone Input ── */}
          <Animated.View style={[styles.formGroup, fadeSlideUp(animPhone)]}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputWrapper}>
              <PhoneIcon />
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                placeholderTextColor={COLORS.muted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>
          </Animated.View>

          {/* ── Password Input ── */}
          <Animated.View style={[styles.formGroup, fadeSlideUp(animPassword)]}>
            <Text style={styles.label}>Password *</Text>
            <View style={styles.inputWrapper}>
              <LockIcon />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Min 6 characters"
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

          {/* ── Confirm Password Input ── */}
          <Animated.View style={[styles.formGroup, fadeSlideUp(animConfirmPass)]}>
            <Text style={styles.label}>Confirm Password *</Text>
            <View style={styles.inputWrapper}>
              <LockIcon />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Re-enter your password"
                placeholderTextColor={COLORS.muted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} disabled={loading}>
                <EyeIcon />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── Signup Button ── */}
          <Animated.View style={[styles.ctaRow, fadeSlideUp(animCTA)]}>
            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              activeOpacity={0.82}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Login Link ── */}
          <Animated.View style={[styles.loginBlock, fadeSlideUp(animLogin)]}>
            <Text style={styles.loginText}>
              Already have an account?{' '}
              <Text
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
              >
                Sign In
              </Text>
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(44,26,14,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
  scrollContainer: {
    paddingBottom: 40,
  },

  // ── Title
  titleBlock: {
    marginTop: 8,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'serif',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 40,
    color: COLORS.brown,
    letterSpacing: -1.5,
  },

  // ── Subtitle
  subtitleBlock: {
    marginBottom: 22,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.muted,
    lineHeight: 20,
    letterSpacing: 0.2,
  },

  // ── Name Row
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },

  // ── Form Group
  formGroup: {
    marginBottom: 14,
  },
  formGroupHalf: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.brown,
    marginBottom: 7,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
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

  // ── CTA Button
  ctaRow: {
    width: '100%',
    marginTop: 6,
    marginBottom: 18,
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
  btnDisabled: {
    opacity: 0.6,
  },

  // ── Login Link
  loginBlock: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  loginText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.brownMid,
    letterSpacing: 0.1,
  },
  loginLink: {
    color: COLORS.orange,
    fontWeight: '700',
  },

  // ── Error message
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

  // ── Success message
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
});

export default SignupScreen;
