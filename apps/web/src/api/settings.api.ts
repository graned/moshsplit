import { apiClient } from './client';
import { API_ENDPOINTS } from './config';

export interface SecuritySettings {
  mfaEnabled: boolean;
  mfaMethod?: string;
  lastPasswordChange?: string;
}

export interface EnableMfaRequest {
  method: 'totp' | 'email';
}

export interface EnableMfaResponse {
  secret?: string;
  qrCode?: string;
  message: string;
}

export interface VerifyMfaRequest {
  code: string;
}

export interface DisableMfaRequest {
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
}

export const settingsApi = {
  getSecurity: async (): Promise<SecuritySettings> => {
    return apiClient.get<SecuritySettings>(API_ENDPOINTS.settings.security);
  },

  enableMfa: async (data: EnableMfaRequest): Promise<EnableMfaResponse> => {
    return apiClient.post<EnableMfaResponse>(`${API_ENDPOINTS.settings.mfa}/enable`, data);
  },

  verifyMfa: async (data: VerifyMfaRequest): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>(`${API_ENDPOINTS.settings.mfa}/verify`, data);
  },

  disableMfa: async (data: DisableMfaRequest): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>(`${API_ENDPOINTS.settings.mfa}/disable`, data);
  },

  changePassword: async (data: ChangePasswordRequest): Promise<ChangePasswordResponse> => {
    return apiClient.post<ChangePasswordResponse>(API_ENDPOINTS.settings.changePassword, data);
  },
};
