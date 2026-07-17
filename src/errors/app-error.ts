import type { ErrorDetail, ErrorPayload } from "../types/response.js";
import { HttpStatus } from "../types/http-status.js";
import { ErrorCode } from "./error-codes.js";

export interface AppErrorOptions {
  /** Field-level breakdown, typically used by ValidationError. */
  details?: ErrorDetail[];
  /**
   * Operational errors are expected, "normal" failures (bad input, not found,
   * a duplicate key, ...) - safe to report to the client as-is. Programmer
   * errors / unexpected exceptions (isOperational: false) should be logged
   * loudly and their details hidden from the client in production.
   */
  isOperational?: boolean;
  /** The underlying error this one wraps, if any (preserved for logging, never serialized to clients). */
  cause?: unknown;
}

/**
 * Base class for every error this library throws or expects you to throw.
 * Extend it directly for domain-specific errors that don't fit the built-in
 * HTTP error classes:
 *
 *   class InsufficientFundsError extends AppError {
 *     constructor(accountId: string) {
 *       super(`Account ${accountId} has insufficient funds`, 402, "INSUFFICIENT_FUNDS");
 *     }
 *   }
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;
  readonly details?: ErrorDetail[];

  constructor(message: string, statusCode: number, code: string, options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = options.isOperational ?? true;
    if (options.details) this.details = options.details;

    // Keeps the constructor call itself out of the stack trace (V8 only; no-op elsewhere).
    Error.captureStackTrace?.(this, new.target);
  }

  /** Serializes to the `error` payload shape used inside ErrorResponse. `includeStack` defaults to false. */
  toJSON(includeStack = false): ErrorPayload {
    const payload: ErrorPayload = { code: this.code, message: this.message };
    if (this.details) payload.details = this.details;
    if (includeStack && this.stack) payload.stack = this.stack;
    return payload;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", options?: AppErrorOptions) {
    super(message, HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, options);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: ErrorDetail[], options: AppErrorOptions = {}) {
    const resolvedDetails = details ?? options.details;
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.VALIDATION_ERROR, {
      ...options,
      ...(resolvedDetails ? { details: resolvedDetails } : {}),
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", options?: AppErrorOptions) {
    super(message, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, options);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action", options?: AppErrorOptions) {
    super(message, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, options);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", options?: AppErrorOptions) {
    super(message, HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, options);
  }
}

export class MethodNotAllowedError extends AppError {
  constructor(message = "Method not allowed", options?: AppErrorOptions) {
    super(message, HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.METHOD_NOT_ALLOWED, options);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", options?: AppErrorOptions) {
    super(message, HttpStatus.CONFLICT, ErrorCode.CONFLICT, options);
  }
}

export class GoneError extends AppError {
  constructor(message = "Resource no longer available", options?: AppErrorOptions) {
    super(message, HttpStatus.GONE, ErrorCode.GONE, options);
  }
}

export class PreconditionFailedError extends AppError {
  constructor(message = "Precondition failed", options?: AppErrorOptions) {
    super(message, HttpStatus.PRECONDITION_FAILED, ErrorCode.PRECONDITION_FAILED, options);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "Payload too large", options?: AppErrorOptions) {
    super(message, HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.PAYLOAD_TOO_LARGE, options);
  }
}

export class TooManyRequestsError extends AppError {
  /** Seconds the client should wait before retrying, surfaced as a `Retry-After` header by the middleware. */
  readonly retryAfterSeconds?: number;

  constructor(message = "Too many requests", retryAfterSeconds?: number, options?: AppErrorOptions) {
    super(message, HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS, options);
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal server error", options?: AppErrorOptions) {
    // Defaults to isOperational: false - an internal error means something
    // unexpected broke, not a "normal" failure the caller should expect.
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_SERVER_ERROR, {
      isOperational: false,
      ...options,
    });
  }
}

export class NotImplementedError extends AppError {
  constructor(message = "Not implemented", options?: AppErrorOptions) {
    super(message, HttpStatus.NOT_IMPLEMENTED, ErrorCode.NOT_IMPLEMENTED, options);
  }
}

export class BadGatewayError extends AppError {
  constructor(message = "Bad gateway", options?: AppErrorOptions) {
    super(message, HttpStatus.BAD_GATEWAY, ErrorCode.BAD_GATEWAY, { isOperational: false, ...options });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable", options?: AppErrorOptions) {
    super(message, HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.SERVICE_UNAVAILABLE, {
      isOperational: false,
      ...options,
    });
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(message = "Gateway timeout", options?: AppErrorOptions) {
    super(message, HttpStatus.GATEWAY_TIMEOUT, ErrorCode.GATEWAY_TIMEOUT, { isOperational: false, ...options });
  }
}
