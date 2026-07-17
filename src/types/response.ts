/**
 * Every response this library produces carries a `success` discriminant so
 * consumers (frontend, other services) can narrow the type with a single
 * `if (response.success)` check instead of inspecting status codes.
 */
import type { PaginationMeta } from "./pagination.js";

/** Free-form metadata attached to any response. `timestamp` is always set by the builders. */
export interface ResponseMeta {
  /** ISO-8601 timestamp of when the response was constructed. */
  timestamp: string;
  /** Correlation id for tracing a request across services/logs, if available. */
  requestId?: string;
  /** Any additional metadata callers want to attach (API version, deprecation notices, etc). */
  [key: string]: unknown;
}

/** A single field/value-level error detail, used for validation failures. */
export interface ErrorDetail {
  /** Dot-path of the offending field, e.g. "address.zipCode". Omitted for non-field errors. */
  field?: string;
  /** Human-readable explanation of what's wrong with this field. */
  message: string;
  /** Machine-readable sub-code for this specific detail (e.g. "too_small", "invalid_type"). */
  code?: string;
}

/** The `error` payload embedded in every `ErrorResponse`. */
export interface ErrorPayload {
  /** Stable, machine-readable error code (e.g. "NOT_FOUND", "VALIDATION_ERROR"). Safe to switch on. */
  code: string;
  /** Human-readable message. Safe to display to end users for operational errors. */
  message: string;
  /** Field-level breakdown, typically present for validation errors. */
  details?: ErrorDetail[];
  /** Stack trace - only ever populated when explicitly opted into (e.g. non-production). */
  stack?: string;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  statusCode: number;
  /** Optional human-readable message, e.g. "User created successfully". */
  message?: string;
  data: T;
  /** Present on list/collection responses built via the pagination helpers. */
  pagination?: PaginationMeta;
  meta: ResponseMeta;
}

export interface ErrorResponse {
  success: false;
  statusCode: number;
  error: ErrorPayload;
  meta: ResponseMeta;
}

/** The full response union - what a client should expect to receive and can discriminate on `success`. */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;
