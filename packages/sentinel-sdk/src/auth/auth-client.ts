import Ky from 'ky';
import type { ApiEnvelope } from '../types/common';
import type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  LoginResult,
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
  UserProfile,
  UserPermissions,
} from './types';

/**
 * MFA client for Sentinel MFA endpoints
 */
export class MfaClient {
  private readonly api: typeof Ky;

  constructor(api: typeof Ky) {
    this.api = api;
  }

  /**
   * Verify MFA code
   * POST /v1/api/auth/mfa/verify
   */
  async verify(request: MfaVerifyRequest): Promise<MfaVerifyResponse> {
    const response = await this.api.post('v1/api/auth/mfa/verify', {
      json: request,
    });

    const envelope = await response.json() as ApiEnvelope<MfaVerifyResponse>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'MFA verification failed');
    }

    // Return with both snake_case and camelCase for compatibility
    const data = envelope.data;
    const result: MfaVerifyResponse = {
      // Snake_case (API response)
      user_id: data.user_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      // CamelCase (sentinel-auth-react format) - always present
      userId: data.userId ?? data.user_id,
      accessToken: data.accessToken ?? data.access_token,
      refreshToken: data.refreshToken ?? data.refresh_token,
      expiresAt: data.expiresAt ?? data.expires_at,
    };
    return result;
  }

  /**
   * Start TOTP MFA setup
   * POST /v1/api/auth/mfa/totp/start
   */
  async totpStart(accessToken: string): Promise<TotpStartResponse> {
    const response = await this.api.post(
      'v1/api/auth/mfa/totp/start',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const envelope = await response.json() as ApiEnvelope<TotpStartResponse>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'Failed to start MFA setup');
    }

    return envelope.data;
  }

  /**
   * Confirm TOTP MFA setup
   * POST /v1/api/auth/mfa/totp/confirm
   */
  async totpConfirm(accessToken: string, request: TotpConfirmRequest): Promise<TotpConfirmResponse> {
    const response = await this.api.post(
      'v1/api/auth/mfa/totp/confirm',
      {
        json: request,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const envelope = await response.json() as ApiEnvelope<TotpConfirmResponse>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'Failed to confirm MFA setup');
    }

    return envelope.data;
  }
}

/**
 * User client for Sentinel user endpoints
 */
export class UserClient {
  private readonly api: typeof Ky;

  constructor(api: typeof Ky) {
    this.api = api;
  }

  /**
   * Get current user profile
   * GET /v1/api/user/me
   */
  async getMe(accessToken: string): Promise<UserProfile> {
    const response = await this.api.get('v1/api/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const envelope = await response.json() as ApiEnvelope<UserProfile>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'Failed to get user profile');
    }

    return envelope.data;
  }

  /**
   * Get user permissions
   * GET /v1/api/user/permissions
   */
  async getPermissions(accessToken: string): Promise<UserPermissions> {
    const response = await this.api.get('v1/api/user/permissions', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const envelope = await response.json() as ApiEnvelope<UserPermissions>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'Failed to get user permissions');
    }

    return envelope.data;
  }

  /**
   * Change user password
   * POST /v1/api/user/password/change
   */
  async changePassword(accessToken: string, request: ChangePasswordRequest): Promise<void> {
    const response = await this.api.post(
      'v1/api/user/password/change',
      {
        json: request,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const envelope = await response.json() as ApiEnvelope<unknown>;
      throw new Error(envelope.error?.message ?? 'Failed to change password');
    }
  }
}

/**
 * Auth client for Sentinel authentication endpoints
 */
export class AuthClient {
  private readonly api: typeof Ky;
  /** MFA verification client */
  public readonly mfa: MfaClient;
  /** User profile and permissions client */
  public readonly user: UserClient;

  constructor(baseUrl: string, fetchImpl?: typeof fetch) {
    this.api = Ky.create({
      prefixUrl: baseUrl.replace(/\/$/, ''),
      fetch: fetchImpl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Initialize sub-clients
    this.mfa = new MfaClient(this.api);
    this.user = new UserClient(this.api);
  }

  /**
   * Register a new user
   * POST /v1/api/auth/register
   */
  async register(request: RegisterRequest): Promise<RegisterResponse> {
    const response = await this.api.post('v1/api/auth/register', {
      json: request,
    });

    const envelope = await response.json() as ApiEnvelope<RegisterResponse>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'Registration failed');
    }

    return envelope.data;
  }

  /**
   * Login with email and password
   * POST /v1/api/auth/login
   * Returns LoginResult compatible with sentinel-auth-react
   */
  async login(request: LoginRequest): Promise<LoginResult> {
    const response = await this.api.post('v1/api/auth/login', {
      json: request,
    });

    const envelope = await response.json() as ApiEnvelope<LoginResponse>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'Login failed');
    }

    const data = envelope.data;

    // Check if MFA is required
    if ('mfa_required' in data && data.mfa_required === true) {
      return {
        type: 'mfa',
        mfaSessionToken: data.mfa_session_token ?? data.mfaSessionToken ?? '',
      };
    }

    // MFA not required - return session
    // Extract values preferring camelCase, falling back to snake_case
    const userId = data.userId ?? data.user_id;
    const accessToken = data.accessToken ?? data.access_token;
    const refreshToken = data.refreshToken ?? data.refresh_token;
    const expiresAt = data.expiresAt ?? data.expires_at;

    return {
      type: 'session',
      session: {
        userId,
        accessToken,
        refreshToken,
        expiresAt,
      },
      mustChangePassword: data.mustChangePassword ?? data.must_change_password ?? false,
      mfaSetupRequired: data.mfaSetupRequired ?? data.mfa_setup_required ?? false,
      emailVerified: data.emailVerified ?? data.email_verified ?? true,
    };
  }

  /**
   * Verify MFA code (legacy method, use client.mfa.verify() instead)
   * POST /v1/api/auth/mfa/verify
   */
  async mfaVerify(request: MfaVerifyRequest): Promise<MfaVerifyResponse> {
    return this.mfa.verify(request);
  }

  /**
   * Logout current session
   * POST /v1/api/auth/logout
   */
  async logout(userId: string): Promise<void> {
    // Get the access token from somewhere - for now we pass userId for tracking
    // The logout endpoint may need the token from the auth store
    const response = await this.api.post(
      'v1/api/auth/logout',
      {
        json: { user_id: userId },
      }
    );

    // Logout doesn't return data, just check for success
    if (!response.ok) {
      const envelope = await response.json() as ApiEnvelope<unknown>;
      throw new Error(envelope.error?.message ?? 'Logout failed');
    }
  }

  /**
   * Refresh access token
   * POST /v1/api/auth/token/refresh
   * Accepts either snake_case or camelCase format
   */
  async refreshSession(
    request: string | { userId: string; refreshToken: string }
  ): Promise<RefreshTokenResponse> {
    // Handle both string (just refresh token) and object formats
    let formattedRequest: RefreshTokenRequest;

    if (typeof request === 'string') {
      // If only a string is passed, we need userId from somewhere
      // This is a limitation - the caller should provide the full object
      throw new Error('refreshSession requires userId and refreshToken object');
    } else {
      // Normalize to snake_case for API
      formattedRequest = {
        user_id: request.userId,
        refresh_token: request.refreshToken,
      };
    }

    const response = await this.api.post('v1/api/auth/token/refresh', {
      json: formattedRequest,
    });

    const envelope = await response.json() as ApiEnvelope<RefreshTokenResponse>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'Token refresh failed');
    }

    // Return with both snake_case and camelCase for compatibility
    const data = envelope.data;
    return {
      // Snake_case (API response)
      user_id: data.user_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      // CamelCase (sentinel-auth-react format)
      userId: data.userId ?? data.user_id,
      accessToken: data.accessToken ?? data.access_token,
      refreshToken: data.refreshToken ?? data.refresh_token,
      expiresAt: data.expiresAt ?? data.expires_at,
    };
  }

/**
   * Verify email from email link
   * POST /v1/api/auth/verify-email
   *
   * The token is passed in the request body as JSON.
   */
  async verifyEmail(token: string): Promise<void> {
    const response = await this.api.post('v1/api/auth/verify-email', {
      json: { token },
    });

    if (!response.ok) {
      const envelope = await response.json() as ApiEnvelope<unknown>;
      throw new Error(envelope.error?.message ?? 'Email verification failed');
    }
  }

  /**
   * Request password reset email
   * POST /v1/api/auth/password/forgot
   */
  async passwordForgot(request: PasswordForgotRequest): Promise<void> {
    const response = await this.api.post('v1/api/auth/password/forgot', {
      json: request,
    });

    if (!response.ok) {
      const envelope = await response.json() as ApiEnvelope<unknown>;
      throw new Error(envelope.error?.message ?? 'Password reset request failed');
    }
  }

  /**
   * Reset password with token
   * POST /v1/api/auth/password/reset
   */
  async passwordReset(request: PasswordResetRequest): Promise<void> {
    const response = await this.api.post('v1/api/auth/password/reset', {
      json: request,
    });

    if (!response.ok) {
      const envelope = await response.json() as ApiEnvelope<unknown>;
      throw new Error(envelope.error?.message ?? 'Password reset failed');
    }
  }

  /**
   * Authenticate and authorize request
   * POST /v1/api/auth/authenticate-and-authorize
   */
  async authenticateAndAuthorize(request: AuthenticateAndAuthorizeRequest): Promise<AuthenticateAndAuthorizeResponse> {
    const response = await this.api.post('v1/api/auth/authenticate-and-authorize', {
      json: request,
    });

    const envelope = await response.json() as ApiEnvelope<AuthenticateAndAuthorizeResponse>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'Authorization check failed');
    }

    return envelope.data;
  }

  /**
   * Request password reset email (alias for sentinel-auth-react)
   * POST /v1/api/auth/password/forgot
   */
  async forgotPassword(request: ForgotPasswordRequest): Promise<void> {
    return this.passwordForgot(request);
  }

  /**
   * Reset password with token (alias for sentinel-auth-react)
   * POST /v1/api/auth/password/reset
   */
  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    return this.passwordReset({ token: request.token, new_password: request.new_password });
  }

  /**
   * Resend email verification
   * POST /v1/api/auth/resend-verification
   */
  async resendVerification(request: ResendVerificationRequest): Promise<void> {
    const response = await this.api.post('v1/api/auth/resend-verification', {
      json: request,
    });

    if (!response.ok) {
      const envelope = await response.json() as ApiEnvelope<unknown>;
      throw new Error(envelope.error?.message ?? 'Failed to resend verification email');
    }
  }
}