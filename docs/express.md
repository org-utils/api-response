# Express Adapter (`api-response-tsjs/express`)

```ts
import {
  asyncHandler,
  notFoundHandler,
  errorHandler,
  routeWrapper,
  validateRequest,
} from "api-response-tsjs/express";
import type { ExpressErrorHandlerOptions } from "api-response-tsjs/express";
```

Works with Express 4 and 5 (`express >= 4`).

**Bootstrap**

```ts
import express from "express";
import { errorHandler, notFoundHandler } from "api-response-tsjs/express";

const app = express();

app.get("/health", (_req, res) => res.json(ok({ status: "up" })));

app.use(notFoundHandler());      // must come after all routes
app.use(errorHandler());         // must come last
```

---

## `asyncHandler(handler)`

```ts
function asyncHandler<
  Req extends Request = Request,
  Res extends Response = Response,
>(
  handler: (req: Req, res: Res, next: NextFunction) => Promise<unknown>,
): RequestHandler
```

Wraps an async route handler so a rejected promise is forwarded to `next(err)`
instead of crashing the process or hanging the request. Express 5 does this
automatically; the wrapper keeps route code portable to Express 4 and makes
the intent explicit.

```ts
router.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await userService.getById(req.params.id); // may throw NotFoundError
  res.json(ok(user));
}));
```

---

## `notFoundHandler()`

```ts
function notFoundHandler(): RequestHandler
```

Mount as the **last route** to turn any unmatched request into a consistent
404 `ErrorResponse` (`NOT_FOUND`, `Route not found: <METHOD> <path>`).

```ts
app.use(notFoundHandler());
```

---

## `errorHandler(options?)`

```ts
function errorHandler(options?: ExpressErrorHandlerOptions): ErrorRequestHandler
```

Centralized error-handling middleware. Register it **last**, after all routes
and other middleware. Converts anything forwarded to `next(err)` or thrown
in `asyncHandler`-wrapped routes into a consistent `ErrorResponse` with the
matching status code.

Also handles `TooManyRequestsError`: when `retryAfterSeconds` is set on the
error, a `Retry-After` header is set on the response.

```ts
app.use(errorHandler({
  onError: (err, req) => logger.error({ err, url: req.url, operational: err.isOperational }),
}));
```

### `ExpressErrorHandlerOptions`

```ts
interface ExpressErrorHandlerOptions {
  includeStack?: boolean;
  onError?: (error: ReturnType<typeof normalizeError>, req: Request) => void;
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `includeStack` | `boolean` | `process.env.NODE_ENV !== "production"` | Include `error.stack` in the response body. Always disable in production. |
| `onError` | `(error, req) => void` | - | Called for every error that reaches the handler - hook up your logger here. Non-operational errors are worth alerting on (`error.isOperational`). |

**Behavior**

- Any thrown/forwarded value goes through `normalizeError` first, so plain
  `Error`s, strings, and garbage produce safe `ErrorResponse` bodies.
- If the request carries a string `x-request-id` header, it is echoed back in
  `meta.requestId`.

---

## `routeWrapper(handler)`

```ts
function routeWrapper(
  handler: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<SuccessResponse<unknown>>,
): (req: Request, res: Response, next: NextFunction) => Promise<void>
```

Routes that *return* an envelope instead of calling `res.json` themselves:
the wrapper awaits the handler, sends `res.status(response.statusCode).json(response)`,
and forwards any thrown error to `next(err)`.

```ts
router.get("/users/:id", routeWrapper(async (req, res, next) => {
  const user = await userService.getById(req.params.id);
  return ok(user, { meta: { requestId: req.header("x-request-id") } });
}));
```

---

## `validateRequest(schema, location?)`

```ts
function validateRequest<T>(
  schema: ParsableSchema<T>,
  location?: "body" | "query" | "params",
): RequestHandler
```

Middleware that validates a request part against any schema exposing a
`.parse(data)` method (zod, valibot, arktype, yup, ...). On success the
validated (and possibly transformed/defaulted) value replaces `req.body` /
`req.query` / `req.params`; on failure it forwards a `ValidationError` with
field-level `details` (`Invalid <location> parameters`).

```ts
const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

app.post("/users",
  validateRequest(userSchema),
  asyncHandler(async (req, res) => {
    // req.body is validated and typed
    res.json(created(await users.create(req.body)));
  }),
);

app.get("/users",
  validateRequest(querySchema, "query"),
  asyncHandler(async (req, res) => res.json(ok(await users.list(req.query)))),
);

app.get("/users/:id",
  validateRequest(z.object({ id: z.string().uuid() }), "params"),
  asyncHandler(async (req, res) => res.json(ok(await users.get(req.params.id)))),
);
```

**Behavior**

- Non-schema-shaped failures (any error without an `{ issues }` property) are
  forwarded unchanged.
- `location` defaults to `"body"`.
- Return type for `req.body` etc. is widened to the schema output in the
  handler (assign `req.body = data` means subsequent handlers see the typed
  value at runtime; cast as needed for TypeScript consumers).
