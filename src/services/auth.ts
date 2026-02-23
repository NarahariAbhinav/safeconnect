import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// ─── Configuration ────────────────────────────────────────────────
// The backend URL. When running Expo Go on a physical device,
// use the LAN IP of the machine running the backend (e.g. 192.168.x.x).
// For Android emulator on the same machine use 10.0.2.2.
const API_BASE_URL = 'http://10.0.2.2:5000/api'; // change to your server IP

// Timeout for API calls — if the server doesn't respond within this time,
// fall back to local/offline auth.
const API_TIMEOUT_MS = 6000;

// ─── Helpers ──────────────────────────────────────────────────────
const hashPassword = async (password: string): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs = API_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

// ─── Types ────────────────────────────────────────────────────────
interface User {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  passwordHash?: string; // only present in local-only mode
  createdAt?: string;
}

interface AuthResult {
  success: boolean;
  error?: string;
  user?: User;
  token?: string;
}

// ─── Persist session locally ──────────────────────────────────────
const saveSession = async (user: Omit<User, 'passwordHash'>, token?: string) => {
  await AsyncStorage.setItem('safeconnect_currentUser', JSON.stringify(user));
  if (token) {
    await AsyncStorage.setItem('safeconnect_token', token);
  }
};

// ─── Auth Service ─────────────────────────────────────────────────
export const authService = {

  /**
   * Register — tries backend first, falls back to local AsyncStorage if server
   * is unreachable so the app still works offline.
   */
  register: async (userData: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone: string;
    password: string;
  }): Promise<AuthResult> => {
    // ── Client-side validation (same regardless of mode) ──
    if (!userData.firstName || !userData.phone || !userData.password) {
      return { success: false, error: 'Please fill all required fields' };
    }
    const phoneDigits = userData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return { success: false, error: 'Please enter a valid phone number' };
    }
    if (userData.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    // ── 1) Try backend API ──
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: userData.firstName,
          lastName: userData.lastName || '',
          email: userData.email || undefined,
          phone: userData.phone,
          password: userData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      // Server returned success — save session locally
      const user: User = {
        id: String(data.user?.id ?? Date.now()),
        firstName: data.user?.firstName ?? userData.firstName,
        lastName: data.user?.lastName ?? userData.lastName,
        email: data.user?.email ?? userData.email,
        phone: data.user?.phone ?? userData.phone,
      };
      await saveSession(user, data.token);
      return { success: true, user, token: data.token };
    } catch {
      // Server unreachable — fall through to local mode
    }

    // ── 2) Fallback: local AsyncStorage auth (offline mode) ──
    try {
      const existingUsers = await AsyncStorage.getItem('safeconnect_users');
      const users: User[] = existingUsers ? JSON.parse(existingUsers) : [];

      if (users.some(u => u.phone === userData.phone)) {
        return { success: false, error: 'Phone number already registered' };
      }

      const passwordHash = await hashPassword(userData.password);
      const newUser: User = {
        id: Date.now().toString(),
        firstName: userData.firstName,
        lastName: userData.lastName || '',
        email: userData.email || undefined,
        phone: userData.phone,
        passwordHash,
        createdAt: new Date().toISOString(),
      };

      users.push(newUser);
      await AsyncStorage.setItem('safeconnect_users', JSON.stringify(users));
      await saveSession({
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newUser.phone,
      });

      return { success: true, user: newUser };
    } catch (error: any) {
      return { success: false, error: error.message || 'Registration failed' };
    }
  },

  /**
   * Login — tries backend first, falls back to local AsyncStorage.
   */
  login: async (
    emailOrPhone: string,
    password: string
  ): Promise<AuthResult> => {
    if (!emailOrPhone || !password) {
      return { success: false, error: 'Please enter email/phone and password' };
    }

    // ── 1) Try backend API ──
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailOrPhone.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If server explicitly says "Invalid credentials", don't fall back to local
        if (res.status === 401) {
          return { success: false, error: data.error || 'Invalid credentials' };
        }
        return { success: false, error: data.error || 'Login failed' };
      }

      const user: User = {
        id: String(data.user?.id ?? ''),
        firstName: data.user?.firstName ?? '',
        lastName: data.user?.lastName ?? '',
        email: data.user?.email,
        phone: data.user?.phone ?? emailOrPhone,
      };
      await saveSession(user, data.token);
      return { success: true, user, token: data.token };
    } catch {
      // Server unreachable — fall through to local mode
    }

    // ── 2) Fallback: local AsyncStorage auth ──
    try {
      const existingUsers = await AsyncStorage.getItem('safeconnect_users');
      if (!existingUsers) {
        return { success: false, error: 'No users found. Please sign up first.' };
      }

      const users: User[] = JSON.parse(existingUsers);
      const isPhone = /^\+?[\d\s\-()]+$/.test(emailOrPhone.trim());
      const user = users.find(u =>
        isPhone ? u.phone === emailOrPhone : u.email === emailOrPhone
      );

      if (!user) {
        return { success: false, error: 'User not found. Please check your credentials.' };
      }

      const passwordHash = await hashPassword(password);
      if (user.passwordHash !== passwordHash) {
        return { success: false, error: 'Invalid password' };
      }

      await saveSession({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      });

      return {
        success: true,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed' };
    }
  },

  // Logout — clears local session & tells server (best-effort)
  logout: async (): Promise<{ success: boolean }> => {
    try {
      const token = await AsyncStorage.getItem('safeconnect_token');
      // Best-effort server logout
      if (token) {
        fetchWithTimeout(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {}); // fire & forget
      }
      await AsyncStorage.multiRemove(['safeconnect_currentUser', 'safeconnect_token']);
      return { success: true };
    } catch {
      return { success: false };
    }
  },

  // Get current logged-in user (from local cache)
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const currentUser = await AsyncStorage.getItem('safeconnect_currentUser');
      return currentUser ? JSON.parse(currentUser) : null;
    } catch {
      return null;
    }
  },

  // Check if user is logged in
  isLoggedIn: async (): Promise<boolean> => {
    try {
      const currentUser = await AsyncStorage.getItem('safeconnect_currentUser');
      return currentUser !== null;
    } catch {
      return false;
    }
  },

  // Get stored JWT token
  getToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('safeconnect_token');
    } catch {
      return null;
    }
  },
};
