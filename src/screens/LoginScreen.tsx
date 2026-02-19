/**
 * LoginScreen — uses react-native-reanimated (New Architecture safe)
 * The old react-native Animated API causes "_tracking" TypeError on
 * RN 0.81+ with newArchEnabled:true when navigation.replace() fires
 * mid-animation. Reanimated runs on the UI thread and is fully safe.
 */
import React, { useState } from 'react';
import {
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
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
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

// ─── SVG Icons ─────────────────────────────────────────────────────
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

const LockIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <Path d="M4 8v-1.5A6 6 0 0116 6.5V8M4 8h12v8H4v-8z" stroke={COLORS.brownMid} strokeWidth="1.3" fill="none" strokeLinecap="round" />
    <Circle cx="10" cy="12" r="1.5" fill={COLORS.brownMid} />
  </Svg>
);

const MailIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    <Rect x="2" y="4" width="16" height="12" rx="2" stroke={COLORS.brownMid} strokeWidth="1.3" fill="none" />
    <Path d="M2 4l8 6 8-6" stroke={COLORS.brownMid} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

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

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const handleLogin = async () => {
    setError('');
    setSuccess(false);

    if (!email.trim() || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.login(email.trim(), password);

      if (!result.success) {
        setError(result.error || 'Login failed');
        setLoading(false);
        return;
      }

      // ── Success: navigate immediately, no setTimeout with animations ──
      // Using navigation.replace so back button doesn't return to login
      setSuccess(true);
      setLoading(false);

      // Small delay just for the success state to render, then navigate
      // No Animated values running at this point — safe to navigate
      setTimeout(() => {
        navigation.replace('Home', { user: result.user });
      }, 400);

    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header — FadeInDown from reanimated (New Arch safe) ── */}
      <Animated.View entering={FadeInDown.duration(500).delay(0)} style={styles.header}>
        <View style={styles.logoBadge}>
          <LogoIcon />
        </View>
        <Text style={styles.appName}>
          Safe<Text style={styles.appNameAccent}>Connect</Text>
        </Text>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Title ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(80)} style={styles.titleBlock}>
          <Text style={styles.title}>Welcome{'\n'}Back</Text>
        </Animated.View>

        {/* ── Subtitle ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(160)} style={styles.subtitleBlock}>
          <Text style={styles.subtitle}>Sign in to your SafeConnect account</Text>
        </Animated.View>

        {/* ── Email Input ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(240)} style={styles.formGroup}>
          <Text style={styles.label}>Email Address</Text>
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

        {/* ── Password Input ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(320)} style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={[styles.inputWrapper, passFocused && styles.inputWrapperFocused]}>
            <LockIcon />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter your password"
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
              <EyeIcon visible={showPassword} />
            </TouchableOpacity>
          </View>
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
            <Text style={styles.successText}>Login successful! Redirecting...</Text>
          </Animated.View>
        ) : null}

        {/* ── Forgot Password ── */}
        {!success && (
          <Animated.View entering={FadeInUp.duration(500).delay(400)} style={styles.forgotBlock}>
            <TouchableOpacity disabled={loading} activeOpacity={0.7}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Login Button ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(480)} style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.btnPrimary, (loading || success) && styles.btnDisabled]}
            activeOpacity={0.82}
            onPress={handleLogin}
            disabled={loading || success}
          >
            <Text style={styles.btnPrimaryText}>
              {loading ? 'Signing In...' : success ? '✓ Signed In' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Signup Link ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(560)} style={styles.signupBlock}>
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

  // ── Scroll
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
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 48,
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

  // ── Form
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brown,
    marginBottom: 8,
    letterSpacing: 0.8,
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

  // ── Forgot
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

  // ── CTA
  ctaRow: {
    width: '100%',
    marginBottom: 20,
  },
  btnPrimary: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.orange,
    borderRadius: 100,
    paddingVertical: 17,
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
    opacity: 0.65,
  },

  // ── Signup
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

  // ── Error
  errorBlock: {
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(211,47,47,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
    letterSpacing: 0.1,
  },

  // ── Success
  successBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(42,122,90,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.green,
    borderRadius: 10,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.green,
    letterSpacing: 0.1,
  },
});

export default LoginScreen;
