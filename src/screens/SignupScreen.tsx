/**
 * SignupScreen — migrated to react-native-reanimated
 *
 * FIXES APPLIED:
 * 1. Replaced old react-native Animated API (crashed on New Architecture) with
 *    react-native-reanimated FadeIn entering props — same as LoginScreen.
 * 2. Fixed navigation target: navigate to 'Login' after signup (was 'Welcome'
 *    which is not registered in the navigator → crash).
 * 3. Fixed EyeIcon to accept a `visible` prop so toggle state shows correctly.
 * 4. Added autoCorrect={false} and autoCapitalize="none" to email TextInput.
 */
import React, { useState } from 'react';
import {
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
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
} from 'react-native-svg';
import { authService } from '../services/auth';

// ─── Design Tokens ──────────────────────────────────────────────────
const COLORS = {
  bg: '#EBF4F7',
  orange: '#E05A2B',
  brown: '#2C1A0E',
  brownMid: '#5C3D25',
  green: '#2A7A5A',
  muted: '#8C7060',
  white: '#FFFFFF',
  inputBg: 'rgba(255,255,255,0.85)',
  inputBorder: 'rgba(44,26,14,0.15)',
  inputFocus: 'rgba(224,90,43,0.40)',
  error: '#D32F2F',
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

// FIX: EyeIcon now accepts a `visible` prop so the toggle state is reflected correctly
const EyeIcon: React.FC<{ visible: boolean }> = ({ visible }) => (
  <Svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    {visible ? (
      <>
        <Path d="M10 4c-4 0-7.5 2.5-9 6.5C2.5 15 6 17.5 10 17.5s7.5-2.5 9-7-5-6.5-9-6.5z" stroke={COLORS.muted} strokeWidth="1.2" fill="none" />
        <Circle cx="10" cy="10.5" r="2.5" stroke={COLORS.muted} strokeWidth="1.2" fill="none" />
      </>
    ) : (
      <>
        <Path d="M10 4c-4 0-7.5 2.5-9 6.5C2.5 15 6 17.5 10 17.5s7.5-2.5 9-7-5-6.5-9-6.5z" stroke={COLORS.muted} strokeWidth="1.2" fill="none" />
        <Line x1="3" y1="3" x2="17" y2="17" stroke={COLORS.muted} strokeWidth="1.2" strokeLinecap="round" />
      </>
    )}
  </Svg>
);

const CheckIcon: React.FC = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" fill={COLORS.green} opacity="0.15" />
    <Path d="M7 12l3.5 3.5L17 8" stroke={COLORS.green} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
  const [firstFocused, setFirstFocused] = useState(false);
  const [lastFocused, setLastFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

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
      const result = await authService.register({
        firstName,
        lastName,
        email: email.trim(),
        phone,
        password,
      });

      if (!result.success) {
        setError(result.error || 'Registration failed');
        setLoading(false);
        return;
      }

      setSuccess(true);

      // FIX: Navigate to Login (not 'Welcome' which is not in the navigator)
      setTimeout(() => {
        navigation.replace('Login');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <Animated.View entering={FadeInDown.duration(500).delay(0)} style={styles.header}>
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
          <Animated.View entering={FadeInUp.duration(500).delay(80)} style={styles.titleBlock}>
            <Text style={styles.title}>Create Account</Text>
          </Animated.View>

          {/* ── Subtitle ── */}
          <Animated.View entering={FadeInUp.duration(500).delay(160)} style={styles.subtitleBlock}>
            <Text style={styles.subtitle}>Join SafeConnect and stay protected</Text>
          </Animated.View>

          {/* ── Error Message ── */}
          {error ? (
            <Animated.View entering={FadeInUp.duration(300)} style={styles.errorBlock}>
              <Text style={styles.errorText}>⚠ {error}</Text>
            </Animated.View>
          ) : null}

          {/* ── Success Message ── */}
          {success ? (
            <Animated.View entering={FadeInUp.duration(300)} style={styles.successBlock}>
              <CheckIcon />
              <Text style={styles.successText}>✓ Account created! Redirecting to login...</Text>
            </Animated.View>
          ) : null}

          {/* ── Name Row ── */}
          <Animated.View entering={FadeInUp.duration(500).delay(240)} style={styles.nameRow}>
            {/* First Name */}
            <View style={styles.formGroupHalf}>
              <Text style={styles.label}>First Name *</Text>
              <View style={[styles.inputWrapper, firstFocused && styles.inputWrapperFocused]}>
                <UserIcon />
                <TextInput
                  style={styles.input}
                  placeholder="First"
                  placeholderTextColor={COLORS.muted}
                  value={firstName}
                  onChangeText={setFirstName}
                  editable={!loading}
                  onFocus={() => setFirstFocused(true)}
                  onBlur={() => setFirstFocused(false)}
                />
              </View>
            </View>

            {/* Last Name */}
            <View style={styles.formGroupHalf}>
              <Text style={styles.label}>Last Name</Text>
              <View style={[styles.inputWrapper, lastFocused && styles.inputWrapperFocused]}>
                <UserIcon />
                <TextInput
                  style={styles.input}
                  placeholder="Last"
                  placeholderTextColor={COLORS.muted}
                  value={lastName}
                  onChangeText={setLastName}
                  editable={!loading}
                  onFocus={() => setLastFocused(true)}
                  onBlur={() => setLastFocused(false)}
                />
              </View>
            </View>
          </Animated.View>

          {/* ── Email Input ── */}
          <Animated.View entering={FadeInUp.duration(500).delay(320)} style={styles.formGroup}>
            <Text style={styles.label}>Email Address *</Text>
            <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
              <MailIcon />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={COLORS.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>
          </Animated.View>

          {/* ── Phone Input ── */}
          <Animated.View entering={FadeInUp.duration(500).delay(400)} style={styles.formGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={[styles.inputWrapper, phoneFocused && styles.inputWrapperFocused]}>
              <PhoneIcon />
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                placeholderTextColor={COLORS.muted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!loading}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
              />
            </View>
          </Animated.View>

          {/* ── Password Input ── */}
          <Animated.View entering={FadeInUp.duration(500).delay(480)} style={styles.formGroup}>
            <Text style={styles.label}>Password *</Text>
            <View style={[styles.inputWrapper, passFocused && styles.inputWrapperFocused]}>
              <LockIcon />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Min 6 characters"
                placeholderTextColor={COLORS.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(v => !v)}
                disabled={loading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {/* FIX: Now correctly passes visible prop */}
                <EyeIcon visible={showPassword} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── Confirm Password Input ── */}
          <Animated.View entering={FadeInUp.duration(500).delay(560)} style={styles.formGroup}>
            <Text style={styles.label}>Confirm Password *</Text>
            <View style={[styles.inputWrapper, confirmFocused && styles.inputWrapperFocused]}>
              <LockIcon />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Re-enter your password"
                placeholderTextColor={COLORS.muted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!loading}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(v => !v)}
                disabled={loading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {/* FIX: Now correctly passes visible prop */}
                <EyeIcon visible={showConfirmPassword} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── Signup Button ── */}
          <Animated.View entering={FadeInUp.duration(500).delay(640)} style={styles.ctaRow}>
            <TouchableOpacity
              style={[styles.btnPrimary, (loading || success) && styles.btnDisabled]}
              activeOpacity={0.82}
              onPress={handleSignup}
              disabled={loading || success}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? 'Creating Account...' : success ? '✓ Account Created' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Login Link ── */}
          <Animated.View entering={FadeInUp.duration(500).delay(720)} style={styles.loginBlock}>
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
  inputWrapperFocused: {
    borderColor: COLORS.inputFocus,
    backgroundColor: COLORS.white,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
