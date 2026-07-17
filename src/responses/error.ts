import type { ErrorResponse, ResponseMeta } from "../types/response.js";
import { normalizeError } from "../errors/normalize.js";

export interface ErrorResponseOptions {
  meta?: Partial<ResponseMeta>;
  /** Include the stack trace in the serialized response. Default false - only ever enable this outside production. */
  includeStack?: boolean;
}

/**
 * Builds an ErrorResponse from *anything* that was thrown or rejected -
 * an AppError, a plain Error, or an arbitrary value - via `normalizeError`.
 */
export function errorResponse(error: unknown, options: ErrorResponseOptions = {}): ErrorResponse {
  const appError = normalizeError(error);
  return {
    success: false,
    statusCode: appError.statusCode,
    error: appError.toJSON(options.includeStack ?? false),
    meta: {
      timestamp: new Date().toISOString(),
      ...options.meta,
    },
  };
}
