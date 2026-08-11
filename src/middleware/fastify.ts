import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { errorResponse } from "../responses/error.js";
import {
  NotFoundError,
  ValidationError,
  normalizeError,
} from "../errors/index.js";
import { ZodErrors } from "../utils/zod/zodError.js";
import z from "zod";
export * from "./plugins/fastify-schema-validations.js";

export interface FastifyErrorHandlerOptions {
  /** Include stack traces in the response body. Default: `process.env.NODE_ENV !== "production"`. */
  includeStack?: boolean;
  /** Called for every error - hook up your logger here. `request.log` is also available inside the returned handler if you prefer. */
  onError?: (
    error: ReturnType<typeof normalizeError>,
    request: FastifyRequest,
  ) => void;
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
  const includeStack =
    options.includeStack ?? process.env.NODE_ENV !== "production";

  return function errorHandler(
    error: FastifyError | Error,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const appError = normalizeError(error);
    options.onError?.(appError, request);

    if (
      "retryAfterSeconds" in appError &&
      typeof appError.retryAfterSeconds === "number"
    ) {
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
    throw new NotFoundError(
      `Route not found: ${request.method} ${request.url}`,
    );
  };
}
// Helper function to create validation middleware
/**
 * @example
 * ```typescript
 * // Using with preHandler middleware
 * fastify.post('/users', {
 *   preHandler: validateRequest(userSchema)
 * }, async (req, reply) => {
 *   // req.body is automatically validated and typed
 * });
 * ```
 *  * @example
 * ```typescript
 * // Using with preHandler middleware
 * fastify.post('/users', {
 *   preHandler: validateRequest(userSchema, 'body')
 * }, async (req, reply) => {
 *   // req.body is automatically validated and typed
 * });
 * ```
 *  *  * @example
 * ```typescript
 * // Using with preHandler middleware
 * fastify.post('/users', {
 *   preHandler: validateRequest(userSchema, 'query')
 * }, async (req, reply) => {
 *   // req.query is automatically validated and typed
 * });
 * ```
 *  *  *  * @example
 * ```typescript
 * // Using with preHandler middleware
 * fastify.post('/users', {
 *   preHandler: validateRequest(userSchema, 'params')
 * }, async (req, reply) => {
 *   // req.params is automatically validated and typed
 * });
 * ```
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  location: "body" | "query" | "params" = "body",
) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    try {
      let data;
      switch (location) {
        case "body":
          data = schema.parse(req.body);
          req.body = data;
          break;
        case "query":
          data = schema.parse(req.query);
          req.query = data as any;
          break;
        case "params":
          data = schema.parse(req.params);
          req.params = data as any;
          break;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = ZodErrors.parse(error);
        // reply.code(400).send({
        //   success: false,
        //   statusCode: 400,
        //   errors: errors.flat,
        //   tree: errors.tree,
        //   message: `Invalid ${location} parameters`
        // });
        throw new ValidationError(errors.pretty, errors.flat);
        // return; // Ensure function returns
      }
      throw error;
    }
  };
}
