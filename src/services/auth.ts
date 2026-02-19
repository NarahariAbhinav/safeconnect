import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// Simple encryption/decryption for passwords (in production, use better security)
const hashPassword = async (password: string): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
};

interface User {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  passwordHash: string;
  createdAt: string;
}

export const authService = {
  // Register user locally
  register: async (userData: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      // Check if user already exists
      const existingUsers = await AsyncStorage.getItem('safeconnect_users');
      const users: User[] = existingUsers ? JSON.parse(existingUsers) : [];

      const userExists = users.some(u => u.email === userData.email);
      if (userExists) {
        return { success: false, error: 'Email already registered' };
      }

      // Validate inputs
      if (!userData.firstName || !userData.email || !userData.password) {
        return { success: false, error: 'Please fill all required fields' };
      }

      if (userData.password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      // Create new user
      const passwordHash = await hashPassword(userData.password);
      const newUser: User = {
        id: Date.now().toString(),
        firstName: userData.firstName,
        lastName: userData.lastName || '',
        email: userData.email,
        phone: userData.phone || '',
        passwordHash,
        createdAt: new Date().toISOString(),
      };

      // Save user to local storage
      users.push(newUser);
      await AsyncStorage.setItem('safeconnect_users', JSON.stringify(users));

      // Auto-login the user
      await AsyncStorage.setItem('safeconnect_currentUser', JSON.stringify({
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newUser.phone,
      }));

      console.log('User registered successfully:', newUser.email);
      return {
        success: true,
        user: newUser,
      };
    } catch (error: any) {
      console.error('Registration error:', error);
      return { success: false, error: error.message || 'Registration failed' };
    }
  },

  // Login user locally
  login: async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: any }> => {
    try {
      // Validate inputs
      if (!email || !password) {
        return { success: false, error: 'Please enter email and password' };
      }

      // Get all users from local storage
      const existingUsers = await AsyncStorage.getItem('safeconnect_users');
      if (!existingUsers) {
        return { success: false, error: 'No users found. Please sign up first.' };
      }

      const users: User[] = JSON.parse(existingUsers);

      // Find user by email
      const user = users.find(u => u.email === email);
      if (!user) {
        return { success: false, error: 'User not found. Please check your email.' };
      }

      // Verify password
      const passwordHash = await hashPassword(password);
      if (user.passwordHash !== passwordHash) {
        return { success: false, error: 'Invalid password' };
      }

      // Save current user to local storage
      await AsyncStorage.setItem('safeconnect_currentUser', JSON.stringify({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      }));

      console.log('User logged in successfully:', user.email);
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
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    }
  },

  // Logout user
  logout: async (): Promise<{ success: boolean }> => {
    try {
      await AsyncStorage.removeItem('safeconnect_currentUser');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false };
    }
  },

  // Get current logged-in user
  getCurrentUser: async (): Promise<any | null> => {
    try {
      const currentUser = await AsyncStorage.getItem('safeconnect_currentUser');
      return currentUser ? JSON.parse(currentUser) : null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  // Check if user is logged in
  isLoggedIn: async (): Promise<boolean> => {
    try {
      const currentUser = await AsyncStorage.getItem('safeconnect_currentUser');
      return currentUser !== null;
    } catch (error) {
      return false;
    }
  },
};
