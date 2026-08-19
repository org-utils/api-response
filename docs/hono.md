# Hono Adapter (`api-response-tsjs/hono`)

```ts
import { createErrorHandler, notFoundHandler } from "api-response-tsjs/hono";
import type { HonoErrorHandlerOptions } from "api-response-tsjs/hono";
```

Works with Hono (`hono >= 4`), in any runtime Hono supports (Node, Bun,
Deno, Cloudflare Workers, ...).

**Bootstrap**

```ts
import { Hono } from "hono";
import { createErrorHandler, notFoundHandler } from "api-response-tsjs/hono";

const app = new Hono();

app.onError(createErrorHandler({
  onError: (err, c) => logger.error({ err, url: c.req.url, operational: err.isOperational }),
}));
app.notFound(notFoundHandler());

app.get("/users/:id", (c) => {
  const user = userService.getById(c.req.param("id")); // may throw NotFoundError
  return c.json(ok(user));
});
```

---

## `createErrorHandler(options?)`

```ts
function createErrorHandler(options?: HonoErrorHandlerOptions): ErrorHandler
```

Handler for `app.onError(...)`. Any thrown/rejected error in a Hono handler
flows through here and comes out as a consistent `ErrorResponse` with the
matching HTTP status code.

Sets a `Retry-After` header when the error is a `TooManyRequestsError` with
`retryAfterSeconds`.

```ts
app.onError(createErrorHandler());
```

### `HonoErrorHandlerOptions`

```ts
interface HonoErrorHandlerOptions {
  includeStack?: boolean;
  onError?: (error: ReturnType<typeof normalizeError>, c: Context) => void;
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `includeStack` | `boolean` | `process.env.NODE_ENV !== "production"` | Include `error.stack` in the response body. Always disable in production. |
| `onError` | `(error, c) => void` | - | Called for every error that reaches the handler - hook up your logger here. Non-operational errors are worth alerting on (`error.isOperational`). |

**Behavior**

- Runs every error through `normalizeError`, so even non-`Error` values become
  safe `ErrorResponse` bodies.
- If the request carries a string `x-request-id` header, it is echoed back in
  `meta.requestId`.

---

## `notFoundHandler()`

```ts
function notFoundHandler(): NotFoundHandler
```

Handler for `app.notFound(...)` producing the same `ErrorResponse` shape as
every other error (`NOT_FOUND`, `Route not found: <METHOD> <path>`).

```ts
app.notFound(notFoundHandler());
```
