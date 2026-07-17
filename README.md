# api-response-kit

Type-safe, framework-agnostic **success/error response envelopes**, an
**error class hierarchy**, and **offset + cursor pagination** helpers for
Node.js APIs. Ships optional Express and Fastify adapters and a Zod
integration. Zero required runtime dependencies.

```bash
npm install @dev_config/api-response
```

## Why

Every non-trivial API ends up hand-rolling the same things:

- A consistent JSON shape for success and error responses
- An error class hierarchy that maps cleanly to HTTP status codes
- Something that turns "whatever got thrown" into a safe, serializable error
- Offset pagination (`page`/`limit`) *and* cursor pagination, done properly
- Framework glue (`asyncHandler`, a centralized error handler) that's
  slightly different in every project

This package is that, done once, fully typed, framework-agnostic at the
core, with thin optional adapters for Express and Fastify.

## The response shape

Every response this library builds is one half of a discriminated union:

```ts
type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

interface SuccessResponse<T> {
  success: true;
  statusCode: number;
  message?: string;
  data: T;
  pagination?: PaginationMeta; // present on list endpoints
  meta: { timestamp: string; requestId?: string; [key: string]: unknown };
}

interface ErrorResponse {
  success: false;
  statusCode: number;
  error: { code: string; message: string; details?: ErrorDetail[]; stack?: string };
  meta: { timestamp: string; requestId?: string; [key: string]: unknown };
}
```

Consumers narrow with a single check:

```ts
const res: ApiResponse<User> = await fetchJson("/api/users/1");
if (res.success) {
  console.log(res.data.name); // typed as User
} else {
  console.error(res.error.code, res.error.message);
}
```

## Success responses

```ts
import { ok, created, accepted, noContent, deleted, paginated } from "api-response-kit";

ok({ id: 1, name: "Ada" });
// { success: true, statusCode: 200, data: {...}, meta: { timestamp } }

created({ id: 2 });
// statusCode: 201, message: "Resource created successfully" (override via options.message)

accepted({ jobId: "abc" });
// statusCode: 202 - for queued/async work

noContent();
// statusCode: 204, data: null

deleted({ id: "abc-123" });
// statusCode: 200, message: "Resource deleted successfully"

paginated(items, paginationMeta);
// pagination lives on the envelope (res.pagination), not inside `data`
```

All builders accept an options object for `message`, `meta`, and (for the
generic `successResponse`) `statusCode`:

```ts
import { successResponse } from "api-response-kit";

successResponse(user, { message: "Profile updated", meta: { requestId: "req_123" } });
```

## Errors

```ts
import {
  AppError, BadRequestError, ValidationError, UnauthorizedError, ForbiddenError,
  NotFoundError, ConflictError, TooManyRequestsError, InternalServerError,
  ServiceUnavailableError, // ...and more, see src/errors/app-error.ts
} from "api-response-kit";

throw new NotFoundError(`User ${id} not found`);
throw new ValidationError("Invalid input", [{ field: "email", message: "must be a valid email" }]);
throw new TooManyRequestsError("Slow down", /* retryAfterSeconds */ 30);
```

Every error extends `AppError`: `statusCode`, `code` (a stable machine-readable
string from `ErrorCode`), `isOperational`, and optional `details` /  `cause`.

- **Operational errors** (`isOperational: true`, the default for 4xx) are
  expected failures - bad input, not found, a conflict - safe to report to
  the client as-is.
- **Non-operational errors** (`InternalServerError`, `BadGatewayError`,
  `ServiceUnavailableError`, `GatewayTimeoutError` default to `false`) mean
  something unexpected broke. Log these loudly; the message shown to the
  client should stay generic in production.

Extend `AppError` directly for domain-specific errors:

```ts
class InsufficientFundsError extends AppError {
  constructor(accountId: string) {
    super(`Account ${accountId} has insufficient funds`, 402, "INSUFFICIENT_FUNDS");
  }
}
```

### Turning *anything* thrown into a safe error

```ts
import { normalizeError, errorResponse } from "api-response-kit";

try {
  await doSomething();
} catch (err) {
  const appError = normalizeError(err); // AppError passthrough; anything else -> non-operational InternalServerError
  const body = errorResponse(appError, { includeStack: process.env.NODE_ENV !== "production" });
  res.status(body.statusCode).json(body);
}
```

`normalizeError` never throws - it safely handles `Error` instances, strings,
and arbitrary rejected values (even `undefined`/`null`), so your error
handler doesn't need its own defensive branching.

## Pagination

### Offset (`page` / `limit`)

Best for small/medium datasets, admin UIs, anything needing "jump to page N"
or a total count.

```ts
import { parseOffsetParams, getOffset, buildOffsetMeta, paginated } from "api-response-kit";

// req.query = { page: "2", limit: "20" } (raw, untrusted strings)
const params = parseOffsetParams(req.query, { defaultLimit: 20, maxLimit: 100 });
// -> { page: 2, limit: 20 } - throws ValidationError on garbage input,
//    clamps an over-large limit instead of rejecting it

const [rows, total] = await Promise.all([
  db.query.posts.findMany({ limit: params.limit, offset: getOffset(params) }),
  db.query.posts.count(),
]);

res.json(paginated(rows, buildOffsetMeta(total, params)));
// pagination: { type: "offset", page: 2, limit: 20, total, totalPages, hasNext, hasPrev }
```

### Cursor (opaque, stable under concurrent writes)

Best for large or fast-moving feeds - no expensive `COUNT(*)`/`OFFSET` scans,
and results stay stable even as rows are inserted/deleted between requests.

```ts
import { parseCursorParams, decodeCursor, buildCursorPage, paginated } from "api-response-kit";

const params = parseCursorParams(req.query); // { cursor?, limit }

// Fetch limit + 1 rows - the extra row is how we detect "is there a next page"
// without a separate COUNT query.
const rows = await db.query.posts.findMany({
  where: params.cursor ? gt(posts.id, decodeCursor<{ id: number }>(params.cursor).id) : undefined,
  orderBy: asc(posts.id),
  limit: params.limit + 1,
});

const page = buildCursorPage(rows, params.limit, (post) => ({ id: post.id }), {
  requestCursor: params.cursor,
});

res.json(paginated(page.items, page.meta));
// pagination: { type: "cursor", limit, nextCursor, prevCursor, hasNext, hasPrev }
```

`encodeCursor`/`decodeCursor` are generic - encode whatever fields you sort
by (`{ id }`, `{ createdAt, id }` for a tiebreaker, etc). A malformed/tampered
cursor decodes to a `ValidationError` (422), never a raw parse exception.

```ts
import { isOffsetPagination, isCursorPagination } from "api-response-kit";

if (isOffsetPagination(response.pagination)) {
  console.log(response.pagination.totalPages);
} else if (isCursorPagination(response.pagination)) {
  console.log(response.pagination.nextCursor);
}
```

## CRUD type aliases

Thin, semantic aliases over `SuccessResponse<T>` for documenting route/service
signatures - no runtime difference, just clearer intent:

```ts
import type { GetOneResponse, ListResponse, CreateResponse, UpdateResponse, DeleteResponse } from "api-response-kit";

async function createUser(input: CreateUserInput): Promise<CreateResponse<User>> { ... }
async function listUsers(params: OffsetPaginationParams): Promise<ListResponse<User>> { ... }
```

## Express adapter

```ts
import express from "express";
import { asyncHandler, errorHandler, notFoundHandler } from "api-response-kit/express";
import { NotFoundError } from "api-response-kit";
import { ok } from "api-response-kit";

const app = express();

app.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await userService.getById(req.params.id); // throws NotFoundError if missing
  res.json(ok(user));
}));

// mount last
app.use(notFoundHandler());
app.use(errorHandler({
  includeStack: process.env.NODE_ENV !== "production",
  onError: (err, req) => logger.error({ err, url: req.url }, "request failed"),
}));
```

`asyncHandler` forwards a rejected promise to `next(err)`; `errorHandler`
converts any error reaching it (via `normalizeError`) into the standard
`ErrorResponse` body, sets `Retry-After` for `TooManyRequestsError`, and calls
your `onError` hook for logging.

## Fastify adapter

```ts
import Fastify from "fastify";
import { createErrorHandler, notFoundHandler } from "api-response-kit/fastify";
import { ok } from "api-response-kit";

const app = Fastify();

app.get("/users/:id", async (request) => {
  const user = await userService.getById(request.params.id); // throws NotFoundError if missing
  return ok(user);
});

app.setNotFoundHandler(notFoundHandler());
app.setErrorHandler(createErrorHandler({
  onError: (err, request) => request.log.error({ err }, "request failed"),
}));
```

Fastify handlers can just `return` data or `throw` - no wrapper needed, async
rejections are native.

## Zod integration

```ts
import { fromZodError } from "api-response-kit/zod";

const result = createUserSchema.safeParse(req.body);
if (!result.success) throw fromZodError(result.error);
// -> ValidationError with one ErrorDetail per Zod issue, field paths dot-joined
```

## What's exported

| Module | Contents |
|---|---|
| `api-response-kit` | Types, error classes, `normalizeError`/`isAppError`, success/error builders, offset + cursor pagination helpers, `HttpStatus`, `ErrorCode` |
| `api-response-kit/express` | `asyncHandler`, `errorHandler`, `notFoundHandler` |
| `api-response-kit/fastify` | `createErrorHandler`, `notFoundHandler` |
| `api-response-kit/zod` | `fromZodError` |

Express, Fastify, and Zod are **optional peer dependencies** - install only
the ones you use; the core package has zero required runtime dependencies.

## Design notes

- **ESM + CJS**, with full `.d.ts` declarations for both, via `tsup`. Verified
  against a real consumer project under `moduleResolution: "NodeNext"`.
- **`exactOptionalPropertyTypes: true`** throughout - optional fields are
  either present with a real value or omitted entirely, never explicitly
  `undefined`, so consumers get precise types.
- Pagination metadata lives on the response **envelope** (`res.pagination`),
  not nested inside `data`, so `data` stays exactly "the array of items" for
  every list endpoint.
- `AppError.toJSON()` never includes a stack trace unless you explicitly opt
  in (`includeStack: true`) - safe defaults for production.

## Development

```bash
npm install
npm run typecheck
npm test        # 64 tests: builders, error classes, pagination, express/fastify integration (real HTTP requests), zod
npm run build   # tsup -> dist/ (ESM + CJS + .d.ts)
```
