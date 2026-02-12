import { create } from 'zustand';
import type { User } from '@/types';
import { authAPI } from '@/services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  showAuthModal: boolean;
  authMode: 'signin' | 'signup';
  pendingAction: (() => void) | null;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  openAuthModal: (mode?: 'signin' | 'signup', onSuccess?: () => void) => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  handleOAuthCallback: (token: string) => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('triply_token'),
  isAuthenticated: !!localStorage.getItem('triply_token'),
  showAuthModal: false,
  authMode: 'signin',
  pendingAction: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setToken: (token) => {
    if (token) {
      localStorage.setItem('triply_token', token);
    } else {
      localStorage.removeItem('triply_token');
    }
    set({ token, isAuthenticated: !!token });
  },

  openAuthModal: (mode = 'signin', onSuccess) =>
    set({ showAuthModal: true, authMode: mode, pendingAction: onSuccess || null }),

  closeAuthModal: () =>
    set({ showAuthModal: false, pendingAction: null }),

  login: async (email: string, password: string) => {
    const response = await authAPI.login(email, password);
    if (!response.success) {
      throw new Error(response.message || 'Login failed');
    }
    set({ user: response.user, isAuthenticated: true });
    get().setToken(response.token);
    const pending = get().pendingAction;
    set({ showAuthModal: false, pendingAction: null });
    if (pending) pending();
  },

  signup: async (name: string, email: string, password: string) => {
    const response = await authAPI.register(name, email, password);
    if (!response.success) {
      throw new Error(response.message || 'Registration failed');
    }
    set({ user: response.user, isAuthenticated: true });
    get().setToken(response.token);
    const pending = get().pendingAction;
    set({ showAuthModal: false, pendingAction: null });
    if (pending) pending();
  },

  loginWithGoogle: async () => {
    // Determine intent based on whether user is generating a trip
    const isGeneratingTrip = sessionStorage.getItem('pending_trip_generation') === 'true';
    const intent = isGeneratingTrip ? 'generate_trip' : 'account';
    
    const response = await authAPI.getGoogleAuthUrl(intent);
    if (response.success && response.authUrl) {
      window.location.href = response.authUrl;
    } else {
      throw new Error('Failed to initiate Google sign-in');
    }
  },

  loginWithApple: async () => {
    // Determine intent based on whether user is generating a trip
    const isGeneratingTrip = sessionStorage.getItem('pending_trip_generation') === 'true';
    const intent = isGeneratingTrip ? 'generate_trip' : 'account';
    
    const response = await authAPI.getAppleAuthUrl(intent);
    if (response.success && response.authUrl) {
      window.location.href = response.authUrl;
    } else {
      throw new Error('Failed to initiate Apple sign-in');
    }
  },

  handleOAuthCallback: async (token: string) => {
    get().setToken(token);
    await get().fetchCurrentUser();
    const pending = get().pendingAction;
    set({ showAuthModal: false, pendingAction: null });
    if (pending) pending();
  },

  fetchCurrentUser: async () => {
    try {
      const response = await authAPI.getCurrentUser();
      if (response.success) {
        set({ user: response.user, isAuthenticated: true });
      }
    } catch {
      get().logout();
    }
  },

  logout: () => {
    localStorage.removeItem('triply_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
