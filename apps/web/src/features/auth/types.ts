export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  mfa?: boolean;
  mustChangePassword?: boolean;
  mfaSetupRequired?: boolean;
  emailUnverified?: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  emailVerified: boolean;
  mustChangePassword: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}