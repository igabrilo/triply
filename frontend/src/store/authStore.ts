import { create } from 'zustand';
import type { User } from '@/types';
import { supabase } from '@/services/supabase';
import { authAPI } from '@/services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  showAuthModal: boolean;
  authMode: 'signin' | 'signup';
  pendingAction: (() => void) | null;

  setUser: (user: User | null) => void;
  openAuthModal: (mode?: 'signin' | 'signup', onSuccess?: () => void) => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  logout: () => void;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  showAuthModal: false,
  authMode: 'signin',
  pendingAction: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  openAuthModal: (mode = 'signin', onSuccess) =>
    set({ showAuthModal: true, authMode: mode, pendingAction: onSuccess || null }),

  closeAuthModal: () =>
    set({ showAuthModal: false, pendingAction: null }),

  login: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    // Fetch the full user profile from our backend
    await get().fetchCurrentUser();
    const pending = get().pendingAction;
    set({ showAuthModal: false, pendingAction: null });
    if (pending) pending();
  },

  signup: async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message);

    // Fetch the full user profile from our backend
    // (the DB trigger will have created the public.users row)
    await get().fetchCurrentUser();
    const pending = get().pendingAction;
    set({ showAuthModal: false, pendingAction: null });
    if (pending) pending();
  },

  loginWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw new Error(error.message);
    // Browser will redirect to Google, then back to our app.
    // onAuthStateChange (set up in initAuth) handles the rest.
  },

  loginWithApple: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw new Error(error.message);
  },

  fetchCurrentUser: async () => {
    try {
      const response = await authAPI.getCurrentUser();
      if (response.success) {
        set({ user: response.user, isAuthenticated: true });
      }
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },

  initAuth: async () => {
    // 1. Check for existing Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await get().fetchCurrentUser();
    }
    set({ isLoading: false });

    // 2. Listen for auth state changes (login, logout, token refresh, OAuth callback)
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await get().fetchCurrentUser();
        // Fire any pending action (e.g. trip generation)
        const pending = get().pendingAction;
        if (pending) {
          set({ pendingAction: null });
          pending();
        }
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, isAuthenticated: false });
      }
    });
  },
}));
