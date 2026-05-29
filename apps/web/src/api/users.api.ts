import { apiClient } from './client';

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

export const usersApi = {
  getProfile: async (): Promise<Profile> => {
    throw new Error('Not implemented');
  },

  updateProfile: async (_data: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
    throw new Error('Not implemented');
  },

  listAll: async (): Promise<UserInfo[]> => {
    const response = await apiClient.get<{ success: boolean; data: any[]; error: unknown }>('/v1/users');
    const users = response.data || response;
    return (Array.isArray(users) ? users : []).map((user: any) => ({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
    }));
  },

  list: async (): Promise<UserListItem[]> => {
    const users = await usersApi.listAll();
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: `${u.firstName} ${u.lastName}`.trim() || u.email || 'Unknown',
    }));
  },

  get: async (userId: string): Promise<UserInfo> => {
    const users = await usersApi.listAll();
    const user = users.find((u) => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);
    return user;
  },

  getMany: async (userIds: string[]): Promise<Record<string, UserInfo>> => {
    const users = await usersApi.listAll();
    const result: Record<string, UserInfo> = {};
    userIds.forEach((id) => {
      const found = users.find((u) => u.id === id);
      if (found) result[id] = found;
    });
    return result;
  },
};
