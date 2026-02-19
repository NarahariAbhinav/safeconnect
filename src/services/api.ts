// API Service for backend communication
const API_BASE_URL = 'http://10.180.135.93:5000/api';

interface LoginPayload {
  email: string;
  password: string;
}

interface SignupPayload {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  password: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const apiService = {
  // Login endpoint
  login: async (credentials: LoginPayload): Promise<ApiResponse<any>> => {
    try {
      console.log('Attempting login with:', { email: credentials.email });
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      console.log('Login response:', response.status, data);

      return {
        success: response.ok,
        data: data.user || data,
        error: data.error || data.message,
      };
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message || 'Network error. Please check your connection.',
      };
    }
  },

  // Register/Signup endpoint
  register: async (userData: SignupPayload): Promise<ApiResponse<any>> => {
    try {
      console.log('Attempting registration with:', { email: userData.email });
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      console.log('Register response:', response.status, data);

      return {
        success: response.ok,
        data: data.user || data,
        error: data.error || data.message,
      };
    } catch (error: any) {
      console.error('Register error:', error);
      return {
        success: false,
        error: error.message || 'Network error. Please check your connection.',
      };
    }
  },
};
