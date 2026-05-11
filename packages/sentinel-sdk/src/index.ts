// Re-export public API
export { AuthClient } from './auth/auth-client';
export type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  PasswordForgotRequest,
  PasswordResetRequest,
} from './auth/types';
export type {
  ApiEnvelope,
  ApiError,
  SentinelErrorCode,
  SentinelError,
  SentinelClientOptions,
} from './types/common';