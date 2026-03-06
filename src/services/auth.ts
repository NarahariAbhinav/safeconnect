import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// ─── Configuration ────────────────────────────────────────────────
// Auth is fully local (AsyncStorage). No backend server needed.
// User credentials are stored on-device with SHA-256 hashed passwords.

// ─── Helpers ──────────────────────────────────────────────────────
const hashPassword = async (password: string): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
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
    // ── Validation ──
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

    // ── Local AsyncStorage registration (works fully offline) ──
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

    // ── Local AsyncStorage login (works fully offline) ──
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

  // Logout — clears local session
  logout: async (): Promise<{ success: boolean }> => {
    try {
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
