import Ky from 'ky';
import type { ApiEnvelope } from '../types/common';
import type {
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
  VerifyEmailRequest,
} from './types';

/**
 * Auth client for Sentinel authentication endpoints
 */
export class AuthClient {
  private readonly api: typeof Ky;

  constructor(baseUrl: string, fetchImpl?: typeof fetch) {
    this.api = Ky.create({
      prefixUrl: baseUrl.replace(/\/$/, ''),
      fetch: fetchImpl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
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
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await this.api.post('v1/api/auth/login', {
      json: request,
    });

    const envelope = await response.json() as ApiEnvelope<LoginResponse>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'Login failed');
    }

    return envelope.data;
  }

  /**
   * Verify MFA code
   * POST /v1/api/auth/mfa/verify
   */
  async mfaVerify(request: MfaVerifyRequest): Promise<MfaVerifyResponse> {
    const response = await this.api.post('v1/api/auth/mfa/verify', {
      json: request,
    });

    const envelope = await response.json() as ApiEnvelope<MfaVerifyResponse>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'MFA verification failed');
    }

    return envelope.data;
  }

  /**
   * Logout current session
   * POST /v1/api/auth/logout
   */
  async logout(accessToken: string): Promise<void> {
    const response = await this.api.post(
      'v1/api/auth/logout',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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
   */
  async refreshSession(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const response = await this.api.post('v1/api/auth/token/refresh', {
      json: request,
    });

    const envelope = await response.json() as ApiEnvelope<RefreshTokenResponse>;

    if (!envelope.success || !envelope.data) {
      throw new Error(envelope.error?.message ?? 'Token refresh failed');
    }

    return envelope.data;
  }

  /**
   * Verify email from email link
   * GET /v1/api/auth/verify-email
   */
  async verifyEmail(token: string): Promise<void> {
    const response = await this.api.get('v1/api/auth/verify-email', {
      searchParams: { token },
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
}