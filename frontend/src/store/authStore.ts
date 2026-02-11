import { create } from 'zustand';
import type { User } from '@/types';

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

  login: async (email: string, _password: string) => {
    // Mock login for now
    const mockUser: User = {
      id: '1',
      email,
      name: email.split('@')[0],
      createdAt: new Date().toISOString(),
    };
    const mockToken = 'mock_token_' + Date.now();
    set({ user: mockUser, isAuthenticated: true });
    get().setToken(mockToken);
    const pending = get().pendingAction;
    set({ showAuthModal: false, pendingAction: null });
    if (pending) pending();
  },

  signup: async (name: string, email: string, _password: string) => {
    const mockUser: User = {
      id: '1',
      email,
      name,
      createdAt: new Date().toISOString(),
    };
    const mockToken = 'mock_token_' + Date.now();
    set({ user: mockUser, isAuthenticated: true });
    get().setToken(mockToken);
    const pending = get().pendingAction;
    set({ showAuthModal: false, pendingAction: null });
    if (pending) pending();
  },

  logout: () => {
    localStorage.removeItem('triply_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
