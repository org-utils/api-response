import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  ErrorRequestHandler,
} from "express";
import { errorResponse } from "../responses/error.js";

import type { SuccessResponse } from '../types/index.js'

import { ZodErrors } from "../utils/zod/zodError.js";
import {
  NotFoundError,
  ValidationError,
  normalizeError,
} from "../errors/index.js";

import z from "zod";

/**
 * Wraps an async Express handler so a rejected promise is forwarded to
 * `next(err)` instead of crashing the process / hanging the request.
 * Express 5 actually does this automatically for async handlers, but this
 * wrapper keeps route code portable to Express 4 and makes the intent explicit.
 *
 *   router.get("/users/:id", asyncHandler(async (req, res) => {
 *     const user = await userService.getById(req.params.id); // throws NotFoundError
 *     res.json(ok(user));
 *   }));
 */
export function asyncHandler<
  Req extends Request = Request,
  Res extends Response = Response,
>(
  handler: (req: Req, res: Res, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req as Req, res as Res, next)).catch(next);
  };
}

/** Mount as the last route to turn any unmatched request into a consistent 404 ErrorResponse. */
export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(
      new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`),
    );
  };
}

export interface ExpressErrorHandlerOptions {
  /** Include stack traces in the response body. Default: `process.env.NODE_ENV !== "production"`. */
  includeStack?: boolean;
  /** Called for every error that reaches the handler - hook up your logger here. Non-operational errors are worth alerting on. */
  onError?: (error: ReturnType<typeof normalizeError>, req: Request) => void;
}

/**
 * Centralized Express error-handling middleware. Register it *last*,
 * after all routes and other middleware:
 *
 *   app.use(notFoundHandler());
 *   app.use(errorHandler({ onError: (err, req) => logger.error({ err, url: req.url }) }));
 *
 * Converts any thrown/forwarded error into a consistent `ErrorResponse` body
 * and matching HTTP status code. Sets `Retry-After` for `TooManyRequestsError`
 * when a retry hint was provided.
 */
export function errorHandler(
  options: ExpressErrorHandlerOptions = {},
): ErrorRequestHandler {
  const includeStack =
    options.includeStack ?? process.env.NODE_ENV !== "production";

  return (err, req, res, _next) => {
    const appError = normalizeError(err);
    options.onError?.(appError, req);

    if (
      "retryAfterSeconds" in appError &&
      typeof appError.retryAfterSeconds === "number"
    ) {
      res.setHeader("Retry-After", String(appError.retryAfterSeconds));
    }

    const requestId = req.headers["x-request-id"];
    const body = errorResponse(appError, {
      includeStack,
      meta: typeof requestId === "string" ? { requestId } : {},
    });
    res.status(appError.statusCode).json(body);
  };
}
export function routeWrapper(
  handler: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<SuccessResponse<unknown>>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await handler(req, res, next);
      res.status(response.statusCode).json(response);
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Creates an Express middleware that validates request data using a Zod schema.
 * Supports validation of request body, query parameters, and URL parameters.
 *
 * @param schema - Zod schema to validate against
 * @param location - Which part of the request to validate ('body' | 'query' | 'params')
 * @returns Express middleware that validates the specified request location
 *
 * @example
 * ```typescript
 * // Validate request body
 * const userSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8)
 * });
 *
 * app.post('/users',
 *   validateRequest(userSchema),
 *   (req, res) => {
 *     // req.body is validated and typed
 *   }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Validate query parameters
 * const querySchema = z.object({
 *   page: z.coerce.number().min(1).default(1),
 *   limit: z.coerce.number().min(1).max(100).default(10)
 * });
 *
 * app.get('/users',
 *   validateRequest(querySchema, 'query'),
 *   (req, res) => {
 *     // req.query is validated with defaults applied
 *   }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Validate URL parameters
 * const paramSchema = z.object({
 *   id: z.string().uuid()
 * });
 *
 * app.get('/users/:id',
 *   validateRequest(paramSchema, 'params'),
 *   (req, res) => {
 *     // req.params.id is validated as UUID
 *   }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Multiple validators (params + body)
 * app.put('/users/:id',
 *   validateRequest(paramSchema, 'params'),
 *   validateRequest(updateSchema, 'body'),
 *   (req, res) => {
 *     // Both params and body are validated
 *   }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Using with custom error handler
 * app.post('/users',
 *   validateRequest(userSchema),
 *   (req, res) => {
 *     // Handler
 *   }
 * );
 *
 * // Custom error handler
 * app.use((err, req, res, next) => {
 *   if (err instanceof ValidationError) {
 *     const errors = ZodErrors.parse(err);
 *     return next(
 *       new ValidationError(`Invalid ${location} parameters`, errors.flat),
 *     );
 *   }
 *   next(err);
 * });
 * ```
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  location: "body" | "query" | "params" = "body",
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      let data: T;

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

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = ZodErrors.parse(error);
        return next(
          new ValidationError(`Invalid ${location} parameters`, errors.flat),
        );
      }
      next(error);
    }
  };
}
