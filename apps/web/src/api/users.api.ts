import { useAuthStore } from '@moshsplit/auth-react';

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface UpdateProfileRequest {
  name: string;
  avatarUrl?: string;
}

export interface UpdateProfileResponse {
  user: Profile;
  message: string;
}

const SENTINEL_URL = import.meta.env.VITE_SENTINEL_URL || 'http://localhost:9000';

async function sentinelFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${SENTINEL_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return response;
}

const userCache = new Map<string, UserInfo>();

export const usersApi = {
  getProfile: async (): Promise<Profile> => {
    throw new Error('Not implemented');
  },

  updateProfile: async (_data: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
    throw new Error('Not implemented');
  },

  list: async (): Promise<UserListItem[]> => {
    const response = await sentinelFetch('/v1/api/admin/users');
    const result = await response.json();

    const items = (result.data?.items || []).map((user: any) => ({
      id: user.user_id,
      email: user.email || '',
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      avatarUrl: user.avatar_url,
    }));

    return items;
  },

  get: async (userId: string): Promise<UserInfo> => {
    if (userCache.has(userId)) {
      return userCache.get(userId)!;
    }

    const response = await sentinelFetch(`/v1/api/admin/users/${userId}`);
    const result = await response.json();
    const user = result.data;

    const info: UserInfo = {
      id: user.user_id,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      email: user.email || '',
    };

    userCache.set(userId, info);
    return info;
  },

  getMany: async (userIds: string[]): Promise<Record<string, UserInfo>> => {
    const uncached = userIds.filter((id) => !userCache.has(id));
    if (uncached.length > 0) {
      await Promise.allSettled(uncached.map((id) => usersApi.get(id)));
    }

    const result: Record<string, UserInfo> = {};
    userIds.forEach((id) => {
      const cached = userCache.get(id);
      if (cached) result[id] = cached;
    });
    return result;
  },

  clearCache: () => {
    userCache.clear();
  },
};
