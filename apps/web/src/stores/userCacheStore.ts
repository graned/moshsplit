import { create } from 'zustand';
import { usersApi, UserInfo } from '../api/users.api';

interface UserCacheState {
  users: Map<string, UserInfo>;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  refetch: () => Promise<void>;
  getUser: (id: string) => UserInfo | undefined;
  getAllUsers: () => UserInfo[];
  clear: () => void;
}

export const useUserCacheStore = create<UserCacheState>((set, get) => ({
  users: new Map(),
  isLoading: false,
  isReady: false,
  error: null,

  fetchAll: async () => {
    // Guard against double-fetching
    if (get().isReady) return;
    if (get().isLoading) return;

    set({ isLoading: true, error: null });

    try {
      const userList = await usersApi.listAll();
      const userMap = new Map<string, UserInfo>();
      for (const user of userList) {
        userMap.set(user.id, user);
      }
      set({ users: userMap, isLoading: false, isReady: true, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users';
      set({ isLoading: false, isReady: false, error: message });
    }
  },

  refetch: async () => {
    // Clear state and force a fresh fetch
    usersApi.clearCache();
    set({ users: new Map(), isLoading: false, isReady: false, error: null });
    await get().fetchAll();
  },

  getUser: (id: string) => {
    return get().users.get(id);
  },

  getAllUsers: () => {
    return Array.from(get().users.values());
  },

  clear: () => {
    usersApi.clearCache();
    set({ users: new Map(), isLoading: false, isReady: false, error: null });
  },
}));
