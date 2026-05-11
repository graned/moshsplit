import { apiClient } from './client';
import { API_ENDPOINTS } from './config';

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
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
    return apiClient.get<Profile>(API_ENDPOINTS.users.profile);
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
    return apiClient.put<UpdateProfileResponse>(API_ENDPOINTS.users.updateProfile, data);
  },
};