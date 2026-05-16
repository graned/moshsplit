import { AuthClient } from '@moshsplit/sentinel-sdk';
import { apiClient } from './client';
import { API_ENDPOINTS } from './config';

const sentinelUrl = import.meta.env.VITE_SENTINEL_URL || 'http://localhost:9000';
const authClient = new AuthClient(sentinelUrl);

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

export interface ExternalLoginRequest {
  api_token: string;
  email: string;
}

export interface ExternalLoginResponse {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  email_verified: boolean;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const result = await authClient.login(data);
    if (result.type === 'mfa') {
      throw new Error('MFA required');
    }
    // Successfully got a session
    return {
      token: result.session.accessToken,
      user: {
        id: result.session.userId,
        email: data.email,
        name: '',
        mfaEnabled: false,
        createdAt: new Date().toISOString(),
      },
    };
  },

  logout: async (): Promise<void> => {
    // Logout handled by storing token in authStore
  },

  getCurrentUser: async (): Promise<User> => {
    // This would need to call pitboss-api with token
    throw new Error('Not implemented');
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> => {
    await authClient.passwordForgot({ email: data.email });
    return { message: 'Password reset email sent' };
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<ResetPasswordResponse> => {
    await authClient.passwordReset({
      token: data.token,
      new_password: data.newPassword,
    });
    return { message: 'Password reset successful' };
  },

  acceptInvitation: async (_data: InvitationAcceptRequest): Promise<InvitationAcceptResponse> => {
    // TODO: Implement using Sentinel SDK or custom endpoint
    throw new Error('Not implemented');
  },

  verifyEmail: async (token: string): Promise<void> => {
    await authClient.verifyEmail(token);
  },

  externalLogin: async (data: ExternalLoginRequest): Promise<ExternalLoginResponse> => {
    const response = await apiClient.post<{
      success: boolean;
      data: ExternalLoginResponse | null;
      error: { code: string; message: string } | null;
      timestamp: string;
      request_id: string;
    }>(API_ENDPOINTS.auth.externalLogin, data);

    console.log('[authApi.externalLogin] Raw response keys:', Object.keys(response));
    console.log('[authApi.externalLogin] response.data keys:', response.data ? Object.keys(response.data) : null);
    console.log('[authApi.externalLogin] response.data.access_token:', typeof response.data?.access_token);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'External login failed');
    }

    return response.data;
  },
};
