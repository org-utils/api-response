# Errors (`api-response-tsjs`)

```ts
import {
  // base class
  AppError,
  // built-in error classes
  BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError,
  MethodNotAllowedError, ConflictError, GoneError, PreconditionFailedError,
  PayloadTooLargeError, UnsupportedMediaTypeError, UnprocessableEntityError,
  ValidationError, TooManyRequestsError, InternalServerError,
  NotImplementedError, BadGatewayError, ServiceUnavailableError,
  GatewayTimeoutError, CustomError,
  // helpers
  normalizeError, isAppError, isOperationalError, httpError, createAppError,
  // constants
  HttpStatus, ErrorCode,
} from "api-response-tsjs";
```

Every error class re-exported from `client-api-errors`.

---

## `AppError` — the base class

```ts
class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;
  readonly details?: ErrorDetail[];

  constructor(
    message: string,
    statusCode: number,
    code: string,
    options?: AppErrorOptions,
    name?: string,
  );

  toJSON(includeStack?: boolean): ErrorPayload;
}
```

| Property | Description |
|---|---|
| `statusCode` | HTTP status to send for this error. |
| `code` | Stable, machine-readable string (e.g. `"NOT_FOUND"`). Safe to `switch` on. |
| `isOperational` | `true` = expected failure (bad input, not found) safe to show the client. `false` = unexpected, log loudly. Defaults to `true` unless the class or options say otherwise. |
| `details` | Field-level breakdown (`ErrorDetail[]`), typically for validation errors. |
| `cause` | The underlying error, preserved for logging via `options.cause`. |

`toJSON(includeStack = false)` returns `{ code, message, details?, stack? }` -
a stack trace is **never** included unless you explicitly opt in.

### `AppErrorOptions`

```ts
interface AppErrorOptions {
  cause?: unknown;          // underlying error, for logging
  isOperational?: boolean;  // default true
  details?: ErrorDetail[];  // field-level breakdown
  code?: ErrorCode;         // override the machine-readable code
  statusCode?: HttpStatusCode; // override the HTTP status
}
```

### Extending `AppError`

Domain-specific errors extend the class directly:

```ts
class InsufficientFundsError extends AppError {
  constructor(accountId: string) {
    super(`Account ${accountId} has insufficient funds`, 402, "INSUFFICIENT_FUNDS");
  }
}
```

`ErrorDetail` shape:

```ts
interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
  value?: unknown;
  [key: string]: unknown;
}
```

---

## Built-in error classes

All take `(message?, options?, name?)` unless noted. Defaults are resolved by
`client-api-errors`; `options` may override `statusCode`/`code`/`isOperational`.

| Class | Default status | Default `code` | Default message | Notes |
|---|---|---|---|---|
| `BadRequestError` | 400 | `BAD_REQUEST` | `"Bad request"` | |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | `"Authentication required"` | |
| `ForbiddenError` | 403 | `FORBIDDEN` | `"You do not have permission to perform this action"` | |
| `NotFoundError` | 404 | `NOT_FOUND` | `"Resource not found"` | |
| `MethodNotAllowedError` | 405 | `METHOD_NOT_ALLOWED` | `"Method not allowed"` | |
| `ConflictError` | 409 | `CONFLICT` | `"Resource conflict"` | |
| `GoneError` | 410 | `GONE` | `"Resource no longer available"` | |
| `PreconditionFailedError` | 412 | `PRECONDITION_FAILED` | `"Precondition failed"` | |
| `PayloadTooLargeError` | 413 | `PAYLOAD_TOO_LARGE` | `"Payload too large"` | |
| `UnsupportedMediaTypeError` | 415 | `UNSUPPORTED_MEDIA_TYPE` | `"Unsupported media type"` | |
| `UnprocessableEntityError` | 422 | `UNPROCESSABLE_ENTITY` | `"Unprocessable entity"` | |
| `ValidationError` | 422 | `VALIDATION_ERROR` | `"Validation failed"` | `(message?, details?, options?, name?)` |
| `TooManyRequestsError` | 429 | `TOO_MANY_REQUESTS` | `"Too many requests"` | `(message?, retryAfterSeconds?, options?, name?)`; exposes `retryAfterSeconds` |
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` | `"Internal server error"` | `isOperational: false` by default |
| `NotImplementedError` | 501 | `NOT_IMPLEMENTED` | `"Not implemented"` | |
| `BadGatewayError` | 502 | `BAD_GATEWAY` | `"Bad gateway"` | `isOperational: false` by default |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` | `"Service temporarily unavailable"` | `isOperational: false` by default |
| `GatewayTimeoutError` | 504 | `GATEWAY_TIMEOUT` | `"Gateway timeout"` | `isOperational: false` by default |
| `CustomError` | 500 | `INTERNAL_SERVER_ERROR` | `"Internal server error"` | Intended to be configured via `options` |

**Operational semantics**: 4xx errors are operational (`isOperational: true`,
safe to show clients as-is). The 5xx *server* failures (`InternalServerError`,
`BadGatewayError`, `ServiceUnavailableError`, `GatewayTimeoutError`) default to
`isOperational: false` - log them loudly and keep the message generic in
production.

```ts
throw new NotFoundError(`User ${id} not found`);
throw new ValidationError("Invalid input", [{ field: "email", message: "must be a valid email" }]);
throw new TooManyRequestsError("Slow down", 30); // sends Retry-After: 30 in the adapters
```

---

## Helpers

### `normalizeError(error)`

```ts
function normalizeError(error: unknown): AppError
```

Converts **anything** that could have been thrown into a well-formed
`AppError`, so downstream error handlers never special-case "what if this
isn't an Error". Never throws.

| Input | Result |
|---|---|
| `AppError` | Passed through unchanged. |
| `Error` instance | `InternalServerError(message, { cause, isOperational: false })`. |
| `string` | `InternalServerError(message)` (non-operational). |
| anything else (`null`, `undefined`, objects, ...) | `InternalServerError("An unexpected error occurred", { cause, isOperational: false })`. |

### `isAppError(error)`

```ts
function isAppError(error: unknown): error is AppError
```

### `isOperationalError(error)`

```ts
function isOperationalError(error: unknown): boolean
```

`true` only for an `AppError` with `isOperational: true`.

```ts
catch (err) {
  const appError = normalizeError(err);
  if (isOperationalError(appError)) {
    // expected failure - log at info level
  } else {
    // unexpected - log loudly, alert
  }
}
```

### `httpError(statusCode, message?, options?)`

```ts
function httpError(statusCode: number, message?: string, options?: AppErrorOptions): AppError
```

Maps a status code to the matching built-in class:

| status | class |
|---|---|
| 400, 401, 403, 404, 405, 409, 410, 412, 413, 422, 429, 500, 501, 502, 503, 504 | the corresponding built-in class |
| anything else | generic `AppError(message ?? "Application error", statusCode, `HTTP_${statusCode}`, options)` |

```ts
throw httpError(404, "No such user");
```

### `createAppError(config?)`

```ts
function createAppError(config?: {
  httpStatuses?: number[];
  errorCodes?: string[];
}): {
  badRequest, validation, unauthorized, forbidden, notFound, methodNotAllowed,
  conflict, gone, preconditionFailed, payloadTooLarge, unsupportedMediaType,
  unprocessableEntity, tooManyRequests, internalServerError, notImplemented,
  badGateway, serviceUnavailable, gatewayTimeout, customError:
    (message?: string, options?: AppErrorOptions) => AppError,
  HTTP_STATUS: typeof HttpStatus & Record<number, number>,
  ERROR_CODES: typeof ErrorCode & Record<string, string>,
}
```

Pre-configured factory object - handy for injecting a consistent error helper
set across services. Custom statuses/codes are merged into the exported
`HTTP_STATUS` / `ERROR_CODES` constants.

```ts
const http = createAppError({ httpStatuses: [418], errorCodes: ["TEAPOT"] });
throw http.notFound("No such user");
throw http.customError("I'm a teapot", { statusCode: 418, code: "TEAPOT" });
http.HTTP_STATUS.TEAPOT; // 418
```

Note: `unprocessableEntity` and `validation` both construct a `ValidationError`.

---

## Constants

### `HttpStatus`

```ts
const HttpStatus: {
  OK: 200, CREATED: 201, ACCEPTED: 202, NO_CONTENT: 204,
  BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405, CONFLICT: 409, GONE: 410, PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_MEDIA_TYPE: 415, UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429, INTERNAL_SERVER_ERROR: 500, NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502, SERVICE_UNAVAILABLE: 503, GATEWAY_TIMEOUT: 504,
};
```

### `ErrorCode`

```ts
const ErrorCode: {
  BAD_REQUEST: "BAD_REQUEST", VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED", FORBIDDEN: "FORBIDDEN", NOT_FOUND: "NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED", CONFLICT: "CONFLICT", GONE: "GONE",
  PRECONDITION_FAILED: "PRECONDITION_FAILED", PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY", TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR", NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  BAD_GATEWAY: "BAD_GATEWAY", SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  GATEWAY_TIMEOUT: "GATEWAY_TIMEOUT", UNKNOWN_ERROR: "UNKNOWN_ERROR",
};
```

```ts
if (appError.code === ErrorCode.NOT_FOUND) { /* ... */ }
```
