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
      Authorization: `Bearer ${token}`,
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
let fetchPromise: Promise<void> | null = null;

async function ensureAllUsersFetched(): Promise<void> {
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    const pageSize = 100;
    let page = 1;
    let total = Infinity;

    while ((page - 1) * pageSize < total) {
      const response = await sentinelFetch(`/v1/api/admin/users?page=${page}&page_size=${pageSize}`);
      const result = await response.json();
      const items = result.data?.items || [];
      total = result.data?.total ?? items.length;

      items.forEach((user: any) => {
        const id = user.user_id;
        if (!userCache.has(id)) {
          userCache.set(id, {
            id,
            firstName: user.first_name || '',
            lastName: user.last_name || '',
            email: user.email || '',
          });
        }
      });

      page++;
    }
  })();

  try {
    await fetchPromise;
  } finally {
    fetchPromise = null;
  }
}

export const usersApi = {
  getProfile: async (): Promise<Profile> => {
    throw new Error('Not implemented');
  },

  updateProfile: async (_data: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
    throw new Error('Not implemented');
  },

  listAll: async (): Promise<UserInfo[]> => {
    await ensureAllUsersFetched();
    return Array.from(userCache.values());
  },

  list: async (): Promise<UserListItem[]> => {
    await ensureAllUsersFetched();
    return Array.from(userCache.values()).map((u) => ({
      id: u.id,
      email: u.email,
      name: `${u.firstName} ${u.lastName}`.trim() || u.email || 'Unknown',
    }));
  },

  get: async (userId: string): Promise<UserInfo> => {
    await ensureAllUsersFetched();
    const user = userCache.get(userId);
    if (!user) throw new Error(`User ${userId} not found`);
    return user;
  },

  getMany: async (userIds: string[]): Promise<Record<string, UserInfo>> => {
    await ensureAllUsersFetched();
    const result: Record<string, UserInfo> = {};
    userIds.forEach((id) => {
      const cached = userCache.get(id);
      if (cached) result[id] = cached;
    });
    return result;
  },

  clearCache: () => {
    userCache.clear();
    fetchPromise = null;
  },
};
