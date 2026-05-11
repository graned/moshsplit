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
 * Login response when MFA is NOT required
 */
export interface LoginSuccessResponse {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  mfa_required: false;
}

/**
 * Login response when MFA IS required
 */
export interface MfaRequiredResponse {
  mfa_required: true;
  mfa_session_token: string;
}

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
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

/**
 * Token refresh request payload
 */
export interface RefreshTokenRequest {
  user_id: string;
  refresh_token: string;
}

/**
 * Token refresh response
 */
export interface RefreshTokenResponse {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
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