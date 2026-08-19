import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { errorResponse } from "../responses/error.js";
import { NotFoundError, normalizeError } from "../errors/index.js";

export interface HonoErrorHandlerOptions {
  /** Include stack traces in the response body. Default: `process.env.NODE_ENV !== "production"`. */
  includeStack?: boolean;
  /** Called for every error that reaches the handler - hook up your logger here. Non-operational errors are worth alerting on. */
  onError?: (error: ReturnType<typeof normalizeError>, c: Context) => void;
}

/**
 * Returns a handler for `app.onError(...)`. Any thrown/rejected error in a
 * Hono handler flows through here and comes out as a consistent `ErrorResponse`
 * with the matching HTTP status code. Sets `Retry-After` for
 * `TooManyRequestsError` when a retry hint was provided.
 *
 *   app.onError(createErrorHandler({
 *     onError: (err, c) => c.var.logger.error({ err, url: c.req.url }, "request failed"),
 *   }));
 */
export function createErrorHandler(
  options: HonoErrorHandlerOptions = {},
): ErrorHandler {
  const includeStack =
    options.includeStack ?? process.env.NODE_ENV !== "production";

  return (err, c) => {
    const appError = normalizeError(err);
    options.onError?.(appError, c);

    if (
      "retryAfterSeconds" in appError &&
      typeof appError.retryAfterSeconds === "number"
    ) {
      c.header("Retry-After", String(appError.retryAfterSeconds));
    }

    const requestId = c.req.header("x-request-id");
    const body = errorResponse(appError, {
      includeStack,
      meta: typeof requestId === "string" ? { requestId } : {},
    });
    return c.json(body, appError.statusCode as ContentfulStatusCode);
  };
}

/** Returns a handler for `app.notFound(...)`, producing the same ErrorResponse shape as every other error. */
export function notFoundHandler(): NotFoundHandler {
  return (c) => {
    const appError = new NotFoundError(
      `Route not found: ${c.req.method} ${c.req.url}`,
    );
    return c.json(errorResponse(appError), 404);
  };
}
