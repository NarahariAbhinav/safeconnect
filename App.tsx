import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { Component, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import ContactDetailScreen from './src/screens/ContactDetailScreen';
import ContactsManagerScreen from './src/screens/ContactsManagerScreen';
import EmergencyAccessScreen from './src/screens/EmergencyAccessScreen';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import NeedsReportScreen from './src/screens/NeedsReportScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ReliefMapScreen from './src/screens/ReliefMapScreen';
import ResourceOfferScreen from './src/screens/ResourceOfferScreen';
import SignupScreen from './src/screens/SignupScreen';
import SOSScreen from './src/screens/SOSScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';

const Stack = createNativeStackNavigator();

// ─── Error Boundary ───────────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.emoji}>⚠️</Text>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={errorStyles.btn} onPress={this.handleReset}>
            <Text style={errorStyles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBF4F7', alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#2C1A0E', marginBottom: 8 },
  message: { fontSize: 14, color: '#8C7060', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn: { backgroundColor: '#E05A2B', borderRadius: 100, paddingVertical: 14, paddingHorizontal: 32 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

// ─── Keys ──────────────────────────────────────────────────────────
const KEY_HAS_LAUNCHED = 'safeconnect_has_launched';
const KEY_CURRENT_USER = 'safeconnect_currentUser';

// ─── Splash / Loading Screen (reanimated — New Arch safe) ──────────
const SplashScreen: React.FC = () => {
  const fade = useSharedValue(0);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    fade.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[splashStyles.container, containerStyle]}>
      <Animated.View style={[splashStyles.logoBadge, badgeStyle]}>
        <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <Circle cx="5" cy="12" r="2.5" fill="white" />
          <Circle cx="12" cy="5" r="2.5" fill="white" opacity="0.85" />
          <Circle cx="19" cy="12" r="2.5" fill="white" opacity="0.85" />
          <Circle cx="12" cy="19" r="2.5" fill="white" opacity="0.75" />
          <Line x1="7.2" y1="10.5" x2="10" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <Line x1="14" y1="7" x2="16.8" y2="10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <Line x1="7.2" y1="13.5" x2="10" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <Line x1="14" y1="17" x2="16.8" y2="13.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </Svg>
      </Animated.View>
      <Text style={splashStyles.appName}>
        Safe<Text style={splashStyles.appNameAccent}>Connect</Text>
      </Text>
      <Text style={splashStyles.tagline}>Stay connected when it matters most</Text>
    </Animated.View>
  );
};

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EBF4F7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logoBadge: {
    width: 80,
    height: 80,
    backgroundColor: '#E05A2B',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E05A2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2C1A0E',
    letterSpacing: -0.5,
  },
  appNameAccent: {
    color: '#E05A2B',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8C7060',
    letterSpacing: 0.2,
  },
});

// ─── Route types ───────────────────────────────────────────────────
type InitialRoute = 'Onboarding' | 'Login' | 'Home';

// ─── App ───────────────────────────────────────────────────────────
const App = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<InitialRoute>('Onboarding');
  // Stores the resolved user object for auto-login — passed as initialParams at render
  const [autoLoginUser, setAutoLoginUser] = useState<any>(undefined);

  useEffect(() => {
    const determineInitialRoute = async () => {
      try {
        // Check if app has been launched before
        const hasLaunched = await AsyncStorage.getItem(KEY_HAS_LAUNCHED);

        if (!hasLaunched) {
          // ── FIRST TIME: Show onboarding ──
          await AsyncStorage.setItem(KEY_HAS_LAUNCHED, 'true');
          setInitialRoute('Onboarding');
        } else {
          // ── RETURNING USER: Check if already logged in ──
          const currentUserStr = await AsyncStorage.getItem(KEY_CURRENT_USER);
          if (currentUserStr) {
            const user = JSON.parse(currentUserStr);
            // Already logged in → go straight to Home with user params
            setAutoLoginUser(user);
            setInitialRoute('Home');
          } else {
            // Not logged in → go to Login
            setInitialRoute('Login');
          }
        }
      } catch (e) {
        // Fallback to onboarding on any error
        setInitialRoute('Onboarding');
      } finally {
        setIsReady(true);
      }
    };

    determineInitialRoute();
  }, []);

  if (!isReady) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <SplashScreen />
      </>
    );
  }

  return (
    <ErrorBoundary>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#EBF4F7' },
            animation: 'slide_from_right',
          }}
        >
          {/* ── Public Screens (no login required) ── */}
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen
            name="EmergencyAccess"
            component={EmergencyAccessScreen}
            options={{ animation: 'slide_from_bottom' }}
          />

          {/* ── Auth Screens ── */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />

          {/* ── Post-signup landing ── */}
          <Stack.Screen name="Welcome" component={WelcomeScreen} />

          {/* ── Authenticated Screens ── */}
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            initialParams={autoLoginUser ? { user: autoLoginUser } : undefined}
          />
          <Stack.Screen
            name="ContactsManager"
            component={ContactsManagerScreen as React.ComponentType<any>}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="ContactDetail"
            component={ContactDetailScreen as React.ComponentType<any>}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="SOSScreen"
            component={SOSScreen as React.ComponentType<any>}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="NeedsReport"
            component={NeedsReportScreen as React.ComponentType<any>}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ResourceOffer"
            component={ResourceOfferScreen as React.ComponentType<any>}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ReliefMap"
            component={ReliefMapScreen as React.ComponentType<any>}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
};

export default App;