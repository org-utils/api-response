import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { errorResponse } from "../responses/error.js";
import { NotFoundError } from "../errors/app-error.js";
import { normalizeError } from "../errors/normalize.js";

export interface FastifyErrorHandlerOptions {
  /** Include stack traces in the response body. Default: `process.env.NODE_ENV !== "production"`. */
  includeStack?: boolean;
  /** Called for every error - hook up your logger here. `request.log` is also available inside the returned handler if you prefer. */
  onError?: (error: ReturnType<typeof normalizeError>, request: FastifyRequest) => void;
}

/**
 * Returns a handler for `fastify.setErrorHandler(...)`. Fastify's own
 * validation errors (from route schemas) and any thrown/rejected error in a
 * handler both flow through here and come out as a consistent `ErrorResponse`.
 *
 *   fastify.setErrorHandler(createErrorHandler({
 *     onError: (err, req) => req.log.error({ err }, "request failed"),
 *   }));
 *   fastify.setNotFoundHandler(notFoundHandler());
 */
export function createErrorHandler(options: FastifyErrorHandlerOptions = {}) {
  const includeStack = options.includeStack ?? process.env.NODE_ENV !== "production";

  return function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
    const appError = normalizeError(error);
    options.onError?.(appError, request);

    if ("retryAfterSeconds" in appError && typeof appError.retryAfterSeconds === "number") {
      reply.header("Retry-After", String(appError.retryAfterSeconds));
    }

    const requestId = typeof request.id === "string" ? request.id : undefined;
    const body = errorResponse(appError, {
      includeStack,
      meta: requestId ? { requestId } : {},
    });

    reply.status(appError.statusCode).send(body);
  };
}

/** Returns a handler for `fastify.setNotFoundHandler(...)`, producing the same ErrorResponse shape as every other error. */
export function notFoundHandler() {
  return function handler(request: FastifyRequest, _reply: FastifyReply) {
    throw new NotFoundError(`Route not found: ${request.method} ${request.url}`);
  };
}
