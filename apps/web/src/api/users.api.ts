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
const SENTINEL_API_TOKEN = import.meta.env.VITE_SENTINEL_API_TOKEN;

async function sentinelFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  let token: string | undefined;
  if (endpoint.startsWith('/v1/api/admin')) {
    token = SENTINEL_API_TOKEN || useAuthStore.getState().accessToken;
  } else {
    token = useAuthStore.getState().accessToken;
  }
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

async function fetchAllUsers(): Promise<UserInfo[]> {
  const pageSize = 100;
  let page = 1;
  let total = Infinity;
  const users: UserInfo[] = [];

  while ((page - 1) * pageSize < total) {
    const response = await sentinelFetch(`/v1/api/admin/users?page=${page}&page_size=${pageSize}`);
    const result = await response.json();
    const items = result.data?.items || [];
    total = result.data?.total ?? items.length;

    items.forEach((user: any) => {
      users.push({
        id: user.user_id,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
      });
    });

    page++;
  }

  return users;
}

export const usersApi = {
  getProfile: async (): Promise<Profile> => {
    throw new Error('Not implemented');
  },

  updateProfile: async (_data: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
    throw new Error('Not implemented');
  },

  listAll: async (): Promise<UserInfo[]> => {
    return fetchAllUsers();
  },

  list: async (): Promise<UserListItem[]> => {
    const users = await fetchAllUsers();
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: `${u.firstName} ${u.lastName}`.trim() || u.email || 'Unknown',
    }));
  },

  get: async (userId: string): Promise<UserInfo> => {
    const users = await fetchAllUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);
    return user;
  },

  getMany: async (userIds: string[]): Promise<Record<string, UserInfo>> => {
    const users = await fetchAllUsers();
    const result: Record<string, UserInfo> = {};
    userIds.forEach((id) => {
      const found = users.find((u) => u.id === id);
      if (found) result[id] = found;
    });
    return result;
  },
};
