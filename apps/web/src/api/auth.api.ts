import { apiClient } from './client';
import { API_ENDPOINTS } from './config';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface InvitationAcceptRequest {
  token: string;
  name: string;
  password: string;
}

export interface InvitationAcceptResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>(API_ENDPOINTS.auth.login, data);
  },

  logout: async (): Promise<void> => {
    return apiClient.post<void>(API_ENDPOINTS.auth.logout);
  },

  getCurrentUser: async (): Promise<User> => {
    return apiClient.get<User>(API_ENDPOINTS.auth.currentUser);
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> => {
    return apiClient.post<ForgotPasswordResponse>(API_ENDPOINTS.auth.forgotPassword, data);
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<ResetPasswordResponse> => {
    return apiClient.post<ResetPasswordResponse>(API_ENDPOINTS.auth.resetPassword, data);
  },

  acceptInvitation: async (data: InvitationAcceptRequest): Promise<InvitationAcceptResponse> => {
    return apiClient.post<InvitationAcceptResponse>('/api/v1/invitations/accept', data);
  },
};