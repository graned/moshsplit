/**
 * Sentinel API response wrapper format
 */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  timestamp: string;
  request_id: string;
}

/**
 * Sentinel API error response
 */
export interface ApiError {
  code: string;
  message: string;
}

/**
 * Sentinel error codes
 */
export type SentinelErrorCode =
  | 'AUTH_ERROR'
  | 'INVALID_TOKEN'
  | 'EXPIRED_TOKEN'
  | 'MISSING_TOKEN'
  | 'EMAIL_NOT_VERIFIED'
  | 'MFA_INVALID_CODE'
  | 'MFA_ATTEMPT_LIMIT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'VALIDATION_ERROR'
  | 'MUST_CHANGE_PASSWORD'
  | 'MFA_REQUIRED'
  | 'FORBIDDEN';

/**
 * Sentinel error class with parsed error information
 */
export class SentinelError extends Error {
  public readonly code: SentinelErrorCode;
  public readonly requestId?: string;
  public readonly status: number;
  public readonly statusCode: number;

  constructor(
    message: string,
    code: SentinelErrorCode,
    status: number = 400,
    requestId?: string
  ) {
    super(message);
    this.name = 'SentinelError';
    this.code = code;
    this.status = status;
    this.statusCode = status;
    this.requestId = requestId;
  }

  static fromResponse(envelope: ApiEnvelope<unknown>): SentinelError {
    const error = envelope.error;
    if (!error) {
      return new SentinelError('Unknown error', 'AUTH_ERROR', 500);
    }

    const statusCode = SentinelError.getStatusFromCode(error.code);
    return new SentinelError(
      error.message,
      error.code as SentinelErrorCode,
      statusCode,
      envelope.request_id
    );
  }

  private static getStatusFromCode(code: string): number {
    const statusMap: Record<string, number> = {
      AUTH_ERROR: 401,
      INVALID_TOKEN: 401,
      EXPIRED_TOKEN: 401,
      MISSING_TOKEN: 401,
      EMAIL_NOT_VERIFIED: 403,
      MUST_CHANGE_PASSWORD: 403,
      MFA_INVALID_CODE: 401,
      MFA_ATTEMPT_LIMIT: 429,
      RATE_LIMIT_EXCEEDED: 429,
      VALIDATION_ERROR: 400,
    };
    return statusMap[code] || 500;
  }
}

/**
 * Options for configuring the Sentinel client
 */
export interface SentinelClientOptions {
  /** Base URL of the Sentinel service (e.g., 'http://localhost:9000') */
  baseUrl: string;
  /** Time in milliseconds before token expiry to trigger refresh (default: 5 minutes) */
  refreshBufferMs?: number;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
}

/**
 * Forbidden error - user lacks permission
 */
export class ForbiddenError extends SentinelError {
  constructor(message: string = 'Access denied', requestId?: string) {
    super(message, 'AUTH_ERROR' as SentinelErrorCode, 403, requestId);
    this.name = 'ForbiddenError';
  }
}

/**
 * Email not verified error
 */
export class EmailNotVerifiedError extends SentinelError {
  constructor(message: string = 'Email not verified', requestId?: string) {
    super(message, 'EMAIL_NOT_VERIFIED', 403, requestId);
    this.name = 'EmailNotVerifiedError';
  }
}

/**
 * Unauthorized error - not authenticated
 */
export class UnauthorizedError extends SentinelError {
  constructor(message: string = 'Unauthorized', requestId?: string) {
    super(message, 'MISSING_TOKEN' as SentinelErrorCode, 401, requestId);
    this.name = 'UnauthorizedError';
  }
}