# Fastify Adapter (`api-response-tsjs/fastify`)

```ts
import {
  createErrorHandler,
  notFoundHandler,
  validateRequest,
} from "api-response-tsjs/fastify";
import type { FastifyErrorHandlerOptions } from "api-response-tsjs/fastify";
```

Works with Fastify 4 and 5 (`fastify >= 4`).

**Bootstrap**

```ts
import Fastify from "fastify";
import { createErrorHandler, notFoundHandler } from "api-response-tsjs/fastify";

const app = Fastify();

app.setErrorHandler(createErrorHandler({
  onError: (err, req) => req.log.error({ err }, "request failed"),
}));
app.setNotFoundHandler(notFoundHandler());

app.get("/users/:id", async (req, reply) => {
  const user = await userService.getById(req.params.id); // may throw NotFoundError
  return ok(user);
});
```

---

## `createErrorHandler(options?)`

```ts
function createErrorHandler(
  options?: FastifyErrorHandlerOptions,
): (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => void
```

Handler for `fastify.setErrorHandler(...)`. Fastify's own route-schema
validation errors and any thrown/rejected error in a handler both flow through
here and come out as a consistent `ErrorResponse`.

Sets a `Retry-After` header when the error is a `TooManyRequestsError` with
`retryAfterSeconds`.

```ts
app.setErrorHandler(createErrorHandler());
```

### `FastifyErrorHandlerOptions`

```ts
interface FastifyErrorHandlerOptions {
  includeStack?: boolean;
  onError?: (
    error: ReturnType<typeof normalizeError>,
    request: FastifyRequest,
  ) => void;
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `includeStack` | `boolean` | `process.env.NODE_ENV !== "production"` | Include `error.stack` in the response body. Always disable in production. |
| `onError` | `(error, request) => void` | - | Called for every error - hook up your logger here. `request.log` is also available inside the returned handler if you prefer. |

**Behavior**

- Runs every error through `normalizeError`, so even non-`Error` values become
  safe `ErrorResponse` bodies.
- The request id: when `request.id` is a string it is included in
  `meta.requestId` (Fastify generates one per request by default).

---

## `notFoundHandler()`

```ts
function notFoundHandler(): (request: FastifyRequest, reply: FastifyReply) => never
```

Handler for `fastify.setNotFoundHandler(...)` producing the same `ErrorResponse`
shape as every other error (`NOT_FOUND`, `Route not found: <METHOD> <path>`).

```ts
app.setNotFoundHandler(notFoundHandler());
```

---

## `validateRequest(schema, location?)`

```ts
function validateRequest<T>(
  schema: ParsableSchema<T>,
  location?: "body" | "query" | "params",
): (req: FastifyRequest, reply: FastifyReply) => Promise<void>
```

Pre-handler that validates a request part against any schema exposing a
`.parse(data)` method (zod, valibot, arktype, ...). On success the validated
value replaces `req.body` / `req.query` / `req.params`; on failure it **throws**
a `ValidationError` (`Invalid <location> parameters`) which your
`createErrorHandler` turns into a 422 `ErrorResponse`.

```ts
const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

app.post("/users", {
  preHandler: validateRequest(userSchema),
}, async (req) => {
  // req.body is validated and typed
  return created(await users.create(req.body));
});

app.get("/users", {
  preHandler: validateRequest(querySchema, "query"),
}, async (req) => {
  return ok(await users.list(req.query));
});

app.get("/users/:id", {
  preHandler: validateRequest(z.object({ id: z.string().uuid() }), "params"),
}, async (req) => {
  return ok(await users.get(req.params.id));
});
```

**Behavior**

- Non-schema-shaped failures (any error without an `{ issues }` property) are
  rethrown unchanged.
- `location` defaults to `"body"`.
