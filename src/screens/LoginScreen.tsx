/**
 * LoginScreen — uses react-native-reanimated (New Architecture safe)
 * The old react-native Animated API causes "_tracking" TypeError on
 * RN 0.81+ with newArchEnabled:true when navigation.replace() fires
 * mid-animation. Reanimated runs on the UI thread and is fully safe.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
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
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  // ── Quick Start (offline guest mode) ──
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);

  const handleQuickStart = async () => {
    if (!quickName.trim()) {
      Alert.alert('Enter your name', 'Please enter your full name to continue.');
      return;
    }

    const parsedPhone = quickPhone.trim().replace(/\D/g, '');
    if (parsedPhone.length < 10) {
      Alert.alert(
        'Phone Number Required',
        'Please enter a valid phone number (at least 10 digits). This is strictly required to enable Offline Private Mesh Chat with your contacts.'
      );
      return;
    }

    setQuickLoading(true);
    try {
      const guestUser = {
        id: `guest_${Date.now()}`,
        firstName: quickName.trim().split(' ')[0],
        lastName: quickName.trim().split(' ').slice(1).join(' ') || '',
        // Store only digits so normalizePhone10() works for private mesh chat.
        phone: parsedPhone,
        email: '',
        isGuest: true,
        createdAt: new Date().toISOString(),
      };
      // Save to AsyncStorage — 100% offline, no internet needed
      await AsyncStorage.setItem('safeconnect_currentUser', JSON.stringify(guestUser));
      setQuickLoading(false);
      setShowQuickStart(false);
      setTimeout(() => {
        navigation.replace('Home', { user: guestUser });
      }, 200);
    } catch (e) {
      setQuickLoading(false);
      Alert.alert('Error', 'Could not save. Please try again.');
    }
  };

  const handleLogin = async () => {
    setError('');
    setSuccess(false);

    if (!emailOrPhone.trim() || !password) {
      setError('Please enter your email/phone and password');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.login(emailOrPhone.trim(), password);

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

        {/* ── Email/Phone Input ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(240)} style={styles.formGroup}>
          <Text style={styles.label}>Email or Phone Number</Text>
          <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
            <MailIcon />
            <TextInput
              style={styles.input}
              placeholder="Enter your email or phone number"
              placeholderTextColor={COLORS.muted}
              value={emailOrPhone}
              onChangeText={setEmailOrPhone}
              keyboardType="default"
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

        {/* ── DIVIDER ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(600)} style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </Animated.View>

        {/* ── Quick Start Button ── */}
        <Animated.View entering={FadeInUp.duration(500).delay(650)} style={{ marginBottom: 32 }}>
          <TouchableOpacity
            style={styles.quickStartBtn}
            activeOpacity={0.85}
            onPress={() => setShowQuickStart(true)}
          >
            <Text style={styles.quickStartEmoji}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickStartTitle}>Quick Start — No Internet Needed</Text>
              <Text style={styles.quickStartSub}>Enter just your name · Works 100% offline</Text>
            </View>
            <Text style={styles.quickStartArrow}>→</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* ── Quick Start Modal ── */}
      <Modal
        transparent
        visible={showQuickStart}
        animationType="slide"
        onRequestClose={() => setShowQuickStart(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowQuickStart(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalEmoji}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Quick Start</Text>
                <Text style={styles.modalSub}>No internet needed · 100% offline</Text>
              </View>
            </View>

            {/* What this does */}
            <View style={styles.modalInfoBox}>
              <Text style={styles.modalInfoText}>
                {'✅ Works instantly without internet or signal\n'}
                {'✅ All SOS, Needs, Contacts work offline\n'}
                {'⚠️  You can upgrade to a full account later'}
              </Text>
            </View>

            {/* Name input */}
            <Text style={styles.modalLabel}>YOUR NAME *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter your full name"
              placeholderTextColor={COLORS.muted}
              value={quickName}
              onChangeText={setQuickName}
              autoFocus
              autoCapitalize="words"
            />

            {/* Phone input */}
            <Text style={styles.modalLabel}>PHONE NUMBER * (Required for Private Chat)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 9876543210 — enables private chat"
              placeholderTextColor={COLORS.muted}
              value={quickPhone}
              onChangeText={setQuickPhone}
              keyboardType="phone-pad"
            />

            {/* Go button */}
            <TouchableOpacity
              style={[styles.modalGoBtn, quickLoading && { opacity: 0.65 }]}
              onPress={handleQuickStart}
              activeOpacity={0.85}
              disabled={quickLoading}
            >
              <Text style={styles.modalGoBtnText}>
                {quickLoading ? 'Starting...' : '⚡ Start Using SafeConnect'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowQuickStart(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>Cancel — Use account instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  // ── Divider
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(44,26,14,0.10)' },
  dividerText: { fontSize: 11, fontWeight: '700', color: COLORS.muted, letterSpacing: 1 },

  // ── Quick Start button
  quickStartBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(42,122,90,0.10)',
    borderWidth: 1.5, borderColor: 'rgba(42,122,90,0.30)',
    borderRadius: 16, padding: 16,
  },
  quickStartEmoji: { fontSize: 24 },
  quickStartTitle: { fontSize: 14, fontWeight: '800', color: '#2A7A5A', letterSpacing: -0.2 },
  quickStartSub: { fontSize: 11, fontWeight: '500', color: COLORS.muted, marginTop: 2 },
  quickStartArrow: { fontSize: 18, color: '#2A7A5A', fontWeight: '700' },

  // ── Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(44,26,14,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(44,26,14,0.15)',
    alignSelf: 'center', marginBottom: 20,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  modalEmoji: { fontSize: 32 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.brown, letterSpacing: -0.4 },
  modalSub: { fontSize: 12, fontWeight: '500', color: COLORS.muted, marginTop: 2 },
  modalInfoBox: {
    backgroundColor: 'rgba(42,122,90,0.08)',
    borderWidth: 1, borderColor: 'rgba(42,122,90,0.20)',
    borderRadius: 12, padding: 14, marginBottom: 20,
  },
  modalInfoText: { fontSize: 13, color: '#1B4332', lineHeight: 22, fontWeight: '500' },
  modalLabel: {
    fontSize: 10, fontWeight: '700', color: COLORS.muted,
    letterSpacing: 1, marginBottom: 8, marginLeft: 2,
  },
  modalInput: {
    backgroundColor: COLORS.white, borderWidth: 1.5,
    borderColor: 'rgba(44,26,14,0.15)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, fontWeight: '600', color: COLORS.brown,
    marginBottom: 16,
  },
  modalGoBtn: {
    backgroundColor: '#2A7A5A', borderRadius: 100,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#2A7A5A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    marginBottom: 12,
  },
  modalGoBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
});

export default LoginScreen;
