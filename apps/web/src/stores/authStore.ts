import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../api/client';
import type { User } from '../api/auth.api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
      },

      setToken: (token) => {
        set({ token });
        apiClient.setToken(token);
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      login: (token, user) => {
        apiClient.setToken(token);
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        apiClient.setToken(null);
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      initialize: () => {
        const token = get().token;
        if (token) {
          apiClient.setToken(token);
        }
        set({ isLoading: false });
      },
    }),
    {
      name: 'moshsplit-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
);