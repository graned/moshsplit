/**
 * Registration request payload
 */
export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

/**
 * Registration response (before email verification)
 */
export interface RegisterResponse {
  user_id: string;
  first_name: string;
  last_name: string;
  status: 'PendingVerification';
}

/**
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Session data returned from successful login (camelCase format for sentinel-auth-react)
 */
export interface SessionData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * Login response when MFA is NOT required
 * Includes both snake_case (API) and camelCase (sentinel-auth-react) formats
 */
export interface LoginSuccessResponse {
  // Snake_case (API response format)
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  mfa_required: false;
  // Optional additional fields
  must_change_password?: boolean;
  mfa_setup_required?: boolean;
  email_verified?: boolean;
  // CamelCase (sentinel-auth-react format) - always provided by SDK methods
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  mustChangePassword: boolean;
  mfaSetupRequired: boolean;
  emailVerified?: boolean;
  // Session object (sentinel-auth-react preferred format)
  session?: SessionData;
}

/**
 * Login response when MFA IS required
 */
export interface MfaRequiredResponse {
  mfa_required: true;
  mfa_session_token: string;
  mfaSessionToken?: string;
}

/**
 * Login result type for sentinel-auth-react (tagged union)
 */
export type LoginResult =
  | { type: 'session'; session: SessionData; mustChangePassword: boolean; mfaSetupRequired: boolean; emailVerified?: boolean }
  | { type: 'mfa'; mfaSessionToken: string };

/**
 * Combined login response type
 */
export type LoginResponse = LoginSuccessResponse | MfaRequiredResponse;

/**
 * MFA verify request payload
 */
export interface MfaVerifyRequest {
  mfa_session_token: string;
  code: string;
}

/**
 * MFA verify response
 */
export interface MfaVerifyResponse {
  // Snake_case (API format)
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  // CamelCase (sentinel-auth-react format) - always provided by SDK methods
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * MFA TOTP start response
 */
export interface TotpStartResponse {
  otpauth_uri: string;
}

/**
 * MFA TOTP confirm request
 */
export interface TotpConfirmRequest {
  code: string;
}

/**
 * MFA TOTP confirm response
 */
export interface TotpConfirmResponse {
  recovery_codes: string[];
}

/**
 * Authenticate and authorize request
 */
export interface AuthenticateAndAuthorizeRequest {
  access_token: string;
  method: string;
  path: string;
}

/**
 * Authenticate and authorize response
 */
export interface AuthenticateAndAuthorizeResponse {
  authorized: boolean;
  roles?: UserRole[];
}

/**
 * Password change request
 */
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

/**
 * Forgot password request (alias for sentinel-auth-react)
 */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * Reset password request (alias for sentinel-auth-react)
 */
export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

/**
 * Resend verification request
 */
export interface ResendVerificationRequest {
  email: string;
}

/**
 * Token refresh request payload
 * Supports both snake_case (API) and camelCase (sentinel-auth-react) formats
 */
export interface RefreshTokenRequest {
  // Snake_case (API format)
  user_id: string;
  refresh_token: string;
  // CamelCase (sentinel-auth-react format)
  userId?: string;
  refreshToken?: string;
}

/**
 * Token refresh response
 * Supports both snake_case (API) and camelCase (sentinel-auth-react) formats
 */
export interface RefreshTokenResponse {
  // Snake_case (API format)
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  // CamelCase (sentinel-auth-react format) - always provided by SDK methods
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * Logout request (uses access token in Authorization header)
 */
export interface LogoutRequest {
  access_token: string;
}

/**
 * Password forgot request payload
 */
export interface PasswordForgotRequest {
  email: string;
}

/**
 * Password reset request payload
 */
export interface PasswordResetRequest {
  token: string;
  new_password: string;
}

/**
 * Email verification request (from email link)
 */
export interface VerifyEmailRequest {
  token: string;
}

/**
 * User profile response (from /v1/api/user/me)
 */
export interface UserProfile {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  email_verified: boolean;
  roles: UserRole[];
  created_at: string;
  updated_at: string;
}

/**
 * User role information
 */
export interface UserRole {
  role_id: string;
  role_type: string;
  name: string;
}

/**
 * User permissions response (from /v1/api/user/permissions)
 */
export interface UserPermissions {
  user_id: string;
  roles: UserRole[];
  permissions: string[];
}