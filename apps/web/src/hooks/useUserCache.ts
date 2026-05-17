import { useUserCacheStore } from '../stores/userCacheStore';
import type { UserInfo } from '../api/users.api';

/**
 * Returns the full user cache interface.
 */
export function useUserCache() {
  const getUser = useUserCacheStore((state) => state.getUser);
  const getAllUsers = useUserCacheStore((state) => state.getAllUsers);
  const isLoading = useUserCacheStore((state) => state.isLoading);
  const isReady = useUserCacheStore((state) => state.isReady);
  const error = useUserCacheStore((state) => state.error);
  const refetch = useUserCacheStore((state) => state.refetch);

  return { getUser, getAllUsers, isLoading, isReady, error, refetch };
}

/**
 * Selector hook for a single user by ID.
 */
export function useUser(userId: string | undefined): UserInfo | undefined {
  return useUserCacheStore((state) => (userId ? state.users.get(userId) : undefined));
}

/**
 * Selector hook for multiple users, returned as a Record<id, UserInfo>.
 */
export function useUsers(userIds: string[]): Record<string, UserInfo> {
  return useUserCacheStore((state) => {
    const result: Record<string, UserInfo> = {};
    for (const id of userIds) {
      const user = state.users.get(id);
      if (user) result[id] = user;
    }
    return result;
  });
}
