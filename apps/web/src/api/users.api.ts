import { useAuthStore } from '../stores/authStore';

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

export interface UpdateProfileRequest {
  name: string;
  avatarUrl?: string;
}

export interface UpdateProfileResponse {
  user: Profile;
  message: string;
}

// Sentinel API base URL
const SENTINEL_URL = import.meta.env.VITE_SENTINEL_URL || 'http://localhost:9000';

// Helper to make requests to Sentinel with the current token
async function sentinelFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().token;

  if (!token) {
    throw new Error('Not authenticated');
  }

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

export const usersApi = {
  getProfile: async (): Promise<Profile> => {
    // TODO: Implement profile fetch from Sentinel
    throw new Error('Not implemented');
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
    // TODO: Implement profile update via Sentinel
    throw new Error('Not implemented');
  },

  list: async (): Promise<UserListItem[]> => {
    const response = await sentinelFetch('/v1/api/admin/users');
    const result = await response.json();

    // Transform Sentinel response to UserListItem format
    const items = (result.data?.items || []).map((user: any) => ({
      id: user.user_id,
      email: user.email || '',
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      avatarUrl: user.avatar_url,
    }));

    return items;
  },
};