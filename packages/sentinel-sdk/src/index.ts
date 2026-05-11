// Re-export public API
export { AuthClient, MfaClient, UserClient } from './auth/auth-client';
export type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginSuccessResponse,
  LoginResult,
  SessionData,
  MfaRequiredResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
  TotpStartResponse,
  TotpConfirmRequest,
  TotpConfirmResponse,
  AuthenticateAndAuthorizeRequest,
  AuthenticateAndAuthorizeResponse,
  ChangePasswordRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  PasswordForgotRequest,
  PasswordResetRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ResendVerificationRequest,
  VerifyEmailRequest,
  UserProfile,
  UserPermissions,
  UserRole,
} from './auth/types';
export type {
  ApiEnvelope,
  ApiError,
  SentinelErrorCode,
  SentinelClientOptions,
} from './types/common';
// Export classes as values (not just types)
export { SentinelError, ForbiddenError, EmailNotVerifiedError, UnauthorizedError } from './types/common';