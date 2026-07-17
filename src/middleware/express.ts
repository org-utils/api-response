import type { NextFunction, Request, RequestHandler, Response, ErrorRequestHandler } from "express";
import { errorResponse } from "../responses/error.js";
import { NotFoundError } from "../errors/app-error.js";
import { normalizeError } from "../errors/normalize.js";

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
export function asyncHandler<Req extends Request = Request, Res extends Response = Response>(
  handler: (req: Req, res: Res, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req as Req, res as Res, next)).catch(next);
  };
}

/** Mount as the last route to turn any unmatched request into a consistent 404 ErrorResponse. */
export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
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
export function errorHandler(options: ExpressErrorHandlerOptions = {}): ErrorRequestHandler {
  const includeStack = options.includeStack ?? process.env.NODE_ENV !== "production";

  return (err, req, res, _next) => {
    const appError = normalizeError(err);
    options.onError?.(appError, req);

    if ("retryAfterSeconds" in appError && typeof appError.retryAfterSeconds === "number") {
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
