# Core API (`api-response-tsjs`)

```ts
import {
  // response builders
  successResponse, ok, created, accepted, noContent, deleted, paginated,
  // errors
  errorResponse,
  // pagination
  parseOffsetParams, getOffset, buildOffsetMeta,
  parseCursorParams, buildCursorPage, encodeCursor, decodeCursor,
  // misc
  generateRequestId,
  isOffsetPagination, isCursorPagination,
} from "api-response-tsjs";
```

---

## Response builders

All builders return a `SuccessResponse<T>` (see [Types](#types)) and are pure
functions - they only build the object. Sending it is your framework's job
(`res.json(...)`, `return ...`, `c.json(...)`).

### `successResponse<T>(data, options?)`

Generic success envelope builder. The base for every other builder.

```ts
function successResponse<T>(data: T, options?: SuccessOptions): SuccessResponse<T>
```

**Parameters**

| Param | Type | Description |
|---|---|---|
| `data` | `T` | The payload. Any JSON-serializable value. |
| `options` | `SuccessOptions` | See below. Optional. |

**Returns** `SuccessResponse<T>` with `success: true` and the timestamped `meta`.

**Example**

```ts
successResponse(user, { message: "Profile updated", meta: { requestId: "req_123" } });
```

### `ok<T>(data, options?)` — 200 OK

```ts
function ok<T>(data: T, options?: Omit<SuccessOptions, "statusCode">): SuccessResponse<T>
```

The common case: fetching or successfully mutating a single resource.
`statusCode` is forced to `200`; pass `message` / `meta` / `pagination` via
options.

```ts
ok({ id: 1, name: "Ada" });
```

### `created<T>(data, options?)` — 201 Created

```ts
function created<T>(data: T, options?: Omit<SuccessOptions, "statusCode">): SuccessResponse<T>
```

For POST endpoints that create a resource. `statusCode: 201`, default
`message: "Resource created successfully"` (override via `options.message`).

### `accepted<T>(data, options?)` — 202 Accepted

```ts
function accepted<T>(data: T, options?: Omit<SuccessOptions, "statusCode">): SuccessResponse<T>
```

For queued/async work. `statusCode: 202`, no default message.

### `noContent(options?)` — 204 No Content

```ts
function noContent(options?: Omit<SuccessOptions, "statusCode" | "message">): SuccessResponse<null>
```

`statusCode: 204`, `data: null`. Per the HTTP spec a 204 must not carry a body -
if your framework lets you set one anyway, prefer sending no body and using
this only for typing/logging purposes.

### `deleted<T>(data, options?)` — 200 OK after deletion

```ts
function deleted<T = { id: string | number }>(data: T, options?: Omit<SuccessOptions, "statusCode">): SuccessResponse<T>
```

`statusCode: 200`, default `message: "Resource deleted successfully"`. Default
generic expects the deleted id (`{ id: "abc-123" }`).

### `paginated<T>(items, pagination, options?)` — 200 OK list response

```ts
function paginated<T>(
  items: T[],
  pagination: PaginationMeta,
  options?: Omit<SuccessOptions, "pagination" | "statusCode">,
): SuccessResponse<T[]>
```

`statusCode: 200`. Attaches pagination metadata **at the envelope level**
(`response.pagination`), keeping `data` exactly the array of items.

```ts
paginated(rows, buildOffsetMeta(total, params));
```

### `SuccessOptions`

```ts
interface SuccessOptions {
  message?: string;
  statusCode?: number;
  meta?: Partial<ResponseMeta>;
  pagination?: PaginationMeta;
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `message` | `string` | - | Optional human-readable message. Omitted from the envelope when not set (never `undefined`). |
| `statusCode` | `number` | `200` (`HttpStatus.OK`) | Only meaningful for `successResponse`; the semantic builders force their own status code. |
| `meta` | `Partial<ResponseMeta>` | - | Merged over the auto-generated `{ timestamp }`. Can override `timestamp`. |
| `pagination` | `PaginationMeta` | - | Attached as `response.pagination`. Omitted when not set. |

---

## Error response builder

### `errorResponse(error, options?)`

```ts
function errorResponse(error: unknown, options?: ErrorResponseOptions): ErrorResponse
```

Builds an `ErrorResponse` from **anything** thrown or rejected. Runs the value
through `normalizeError` first (see [errors.md](errors.md)), so a plain
`Error`, a string, or even `null` becomes a safe, serializable error payload.

```ts
const body = errorResponse(err, { includeStack: process.env.NODE_ENV !== "production" });
res.status(body.statusCode).json(body);
```

**Parameters**

| Param | Type | Description |
|---|---|---|
| `error` | `unknown` | The thrown value. |
| `options` | `ErrorResponseOptions` | See below. |

**Returns** `ErrorResponse`: `{ success: false, statusCode, error, meta }`.

### `ErrorResponseOptions`

```ts
interface ErrorResponseOptions {
  meta?: Partial<ResponseMeta>;
  includeStack?: boolean;
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `meta` | `Partial<ResponseMeta>` | - | Merged over `{ timestamp }`. |
| `includeStack` | `boolean` | `false` | Include `error.stack` in the payload. Only enable outside production. |

---

## Offset pagination

Best for small/medium datasets, admin UIs, "jump to page N", or when a total
count is needed.

### `parseOffsetParams(input, config?)`

```ts
function parseOffsetParams(
  input: { page?: unknown; limit?: unknown },
  config?: OffsetParamsConfig,
): OffsetPaginationParams
```

Parses raw, untrusted query input (strings, possibly missing or garbage) into
validated `{ page, limit }`. **Throws `ValidationError`** on clearly invalid
input (`page: 0`, `page: -1`, `limit: "abc"`, `page: 1.5`, ...); an over-large
`limit` is clamped to `maxLimit` instead of rejected.

```ts
const params = parseOffsetParams(req.query, { defaultLimit: 20, maxLimit: 100 });
// req.query = { page: "2", limit: "20" }  →  { page: 2, limit: 20 }
// req.query = {}                          →  { page: 1, limit: 20 }
// req.query = { page: "2", limit: "999" } →  { page: 2, limit: 100 }  (clamped)
// req.query = { page: "-1" }              →  throws ValidationError
```

**Behavior notes**

- Missing, `null`, `undefined`, or `""` values fall back to the configured default.
- Numeric strings are coerced; `limit` must be a positive integer to be accepted.
- Non-string non-number garbage throws.

### `OffsetParamsConfig`

```ts
interface OffsetParamsConfig {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `defaultPage` | `number` | `1` | Used when `page` is missing/empty. |
| `defaultLimit` | `number` | `20` | Used when `limit` is missing/empty. |
| `maxLimit` | `number` | `100` | Upper bound; larger requests are silently clamped. |

### `getOffset(params)`

```ts
function getOffset(params: OffsetPaginationParams): number
```

Zero-indexed SQL-style offset: `(page - 1) * limit`. Use with
`LIMIT ? OFFSET ?`, Drizzle `.offset()`, Prisma `skip`, etc.

```ts
db.query.posts.findMany({ limit: params.limit, offset: getOffset(params) });
```

### `buildOffsetMeta(total, params)`

```ts
function buildOffsetMeta(total: number, params: OffsetPaginationParams): OffsetPaginationMeta
```

Builds the envelope pagination metadata once you know the total row count.

```ts
const [rows, total] = await Promise.all([
  db.query.posts.findMany({ limit: params.limit, offset: getOffset(params) }),
  db.query.posts.count(),
]);
res.json(paginated(rows, buildOffsetMeta(total, params)));
```

**Returns** `OffsetPaginationMeta`:

| Field | Type | Description |
|---|---|---|
| `type` | `"offset"` | Discriminant. |
| `page` | `number` | Echoed request page. |
| `limit` | `number` | Items per page. |
| `total` | `number` | Total rows across all pages. |
| `totalPages` | `number` | `Math.ceil(total / limit)`, `0` when `total === 0`. |
| `hasNext` | `boolean` | `page < totalPages`. |
| `hasPrev` | `boolean` | `page > 1`. |

---

## Cursor pagination

Best for large/fast-moving feeds: no `COUNT(*)`/`OFFSET` scans, stable under
concurrent writes. Cursors are opaque, URL-safe base64 strings.

### `parseCursorParams(input, config?)`

```ts
function parseCursorParams(
  input: { cursor?: unknown; limit?: unknown; direction?: unknown },
  config?: CursorParamsConfig,
): CursorPaginationParams
```

Parses raw query input into `{ limit, cursor?, direction? }`. **Throws
`ValidationError`** on a non-positive/non-integer `limit` or a non-string
`cursor`.

```ts
const params = parseCursorParams(req.query); // { cursor?, limit: 20 }
```

| Input | Result |
|---|---|
| `{}` | `{ limit: 20 }` |
| `{ limit: "50" }` | `{ limit: 50 }` |
| `{ cursor: "abc" }` | `{ limit: 20, cursor: "abc" }` |
| `{ direction: "forward" }` | `{ limit: 20, direction: "forward" }` |
| `{ limit: "0" }` | throws `ValidationError` |
| `{ cursor: 123 }` | throws `ValidationError` |

`direction` is only set when it is exactly `"forward"` or `"backward"`; any
other value is silently dropped.

### `CursorParamsConfig`

```ts
interface CursorParamsConfig {
  defaultLimit?: number;
  maxLimit?: number;
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `defaultLimit` | `number` | `20` | Used when `limit` is missing/empty. |
| `maxLimit` | `number` | `100` | Upper bound; larger requests are clamped. |

### `encodeCursor<T>(payload)`

```ts
function encodeCursor<T extends Record<string, unknown>>(payload: T): string
```

Encodes an arbitrary JSON-serializable object (typically the sort-key values
of the last item, e.g. `{ id, createdAt }`) into an opaque, URL-safe cursor.
Treat the result as a black box.

```ts
encodeCursor({ id: 42, createdAt: "2024-01-01T00:00:00Z" });
// "eyJpZCI6NDIsImNyZWF0ZWRBdCI6IjIwMjQtMDEtMDFUMDA6MDA6MDBaIn0"
```

### `decodeCursor<T>(cursor)`

```ts
function decodeCursor<T extends Record<string, unknown> = Record<string, unknown>>(cursor: string): T
```

Decodes a cursor produced by `encodeCursor`. **Throws `ValidationError`** (not
a raw parse exception) when the cursor is malformed, tampered with, or decodes
to a non-object (arrays and `null` are rejected too), so garbage maps to a 4xx
instead of a 500.

```ts
const { id } = decodeCursor<{ id: number }>(params.cursor);
db.query.posts.findMany({
  where: params.cursor ? gt(posts.id, id) : undefined,
  orderBy: asc(posts.id),
  limit: params.limit + 1,
});
```

### `buildCursorPage<T>(overFetchedItems, limit, getCursorPayload, options?)`

```ts
interface CursorPageResult<T> {
  items: T[];
  meta: CursorPaginationMeta;
}

function buildCursorPage<T>(
  overFetchedItems: T[],
  limit: number,
  getCursorPayload: (item: T) => Record<string, unknown>,
  options?: { requestCursor?: string; hasPrevOverride?: boolean },
): CursorPageResult<T>
```

Builds cursor metadata from an **over-fetched page**: query your data source
for `limit + 1` rows, pass the raw result here, and it detects whether a next
page exists, trims the extra row, and derives the next cursor.

**Parameters**

| Param | Type | Description |
|---|---|---|
| `overFetchedItems` | `T[]` | The `limit + 1` rows fetched from the data source. |
| `limit` | `number` | The page size (from `parseCursorParams`). |
| `getCursorPayload` | `(item) => Record<string, unknown>` | Extracts the sort-key values from an item to encode into a cursor. |
| `options.requestCursor` | `string` | The cursor from the request; drives `hasPrev` (true when this isn't the first page). |
| `options.hasPrevOverride` | `boolean` | Manually force `hasPrev` (for exact bidirectional cursoring: fetch one extra row on the *other* end too). |

**Returns** `CursorPageResult<T>`:

| Field | Type | Description |
|---|---|---|
| `items` | `T[]` | Trimmed page (`limit` items max). |
| `meta.type` | `"cursor"` | Discriminant. |
| `meta.limit` | `number` | Page size. |
| `meta.nextCursor` | `string \| null` | Cursor for the next page, `null` when this is the last page. |
| `meta.prevCursor` | `string \| null` | Cursor for the previous page, `null` when no previous page. |
| `meta.hasNext` | `boolean` | Whether another page follows (derived from the over-fetch). |
| `meta.hasPrev` | `boolean` | `options.hasPrevOverride ?? options.requestCursor !== undefined`. |

```ts
const rows = await db.query.posts.findMany({
  where: params.cursor ? gt(posts.id, decodeCursor<{ id: number }>(params.cursor).id) : undefined,
  orderBy: asc(posts.id),
  limit: params.limit + 1,
});
const page = buildCursorPage(rows, params.limit, (post) => ({ id: post.id }), {
  requestCursor: params.cursor,
});
res.json(paginated(page.items, page.meta));
```

---

## Pagination narrowing helpers

### `isOffsetPagination(meta)`

```ts
function isOffsetPagination(meta: PaginationMeta): meta is OffsetPaginationMeta
```

### `isCursorPagination(meta)`

```ts
function isCursorPagination(meta: PaginationMeta): meta is CursorPaginationMeta
```

Type guards so consumers don't hand-roll `"type" in meta` checks:

```ts
if (isOffsetPagination(response.pagination)) {
  console.log(response.pagination.totalPages);
} else if (isCursorPagination(response.pagination)) {
  console.log(response.pagination.nextCursor);
}
```

---

## Misc

### `generateRequestId()`

```ts
function generateRequestId(): string
```

A `randomUUID()` for correlating logs/responses when the caller doesn't
already have one (e.g. from a header).

```ts
const body = errorResponse(err, { meta: { requestId: generateRequestId() } });
```

---

## Types

Shared response contract types (re-exported from `client-api-types`, which
frontend clients can install to stay type-synchronized with the server).

### Envelope types

```ts
type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

interface SuccessResponse<T = unknown> {
  success: true;
  statusCode: number;
  message?: string;
  data: T;
  pagination?: PaginationMeta;
  meta: ResponseMeta;
}

interface ErrorResponse {
  success: false;
  statusCode: number;
  error: ErrorPayload;
  meta: ResponseMeta;
}

interface ErrorPayload {
  code: string;
  message: string;
  details?: ErrorDetail[];
  stack?: string;
}

interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  [key: string]: unknown;
}
```

### Error detail type

```ts
interface ErrorDetail {
  field?: string;      // dot path, e.g. "address.zipCode"
  message: string;
  code?: string;       // machine-readable sub-code, e.g. "too_small"
  value?: unknown;
  [key: string]: unknown;
}
```

### Pagination types

```ts
type PaginationMeta = OffsetPaginationMeta | CursorPaginationMeta;
type PaginationParams = OffsetPaginationParams | CursorPaginationParams;

interface OffsetPaginationParams {
  page: number;  // 1-indexed
  limit: number;
}

interface OffsetPaginationMeta {
  type: "offset";
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface CursorPaginationParams {
  cursor?: string;
  limit: number;
  direction?: "forward" | "backward";
}

interface CursorPaginationMeta {
  type: "cursor";
  limit: number;
  nextCursor: string | null;
  prevCursor: string | null;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### Sort types

```ts
type SortOrder = "asc" | "desc";

interface SortParams {
  sortBy?: string;
  sortOrder?: SortOrder;
}
```

### CRUD response aliases

Thin, semantic aliases over `SuccessResponse<T>` for documenting
route/service signatures - no runtime difference:

```ts
type GetOneResponse<T> = SuccessResponse<T>;
type ListResponse<T> = SuccessResponse<T[]>;
type CreateResponse<T> = SuccessResponse<T>;
type UpdateResponse<T> = SuccessResponse<T>;
type DeleteResponse<T = { id: string | number } | null> = SuccessResponse<T>;
type BulkResponse = SuccessResponse<BulkResult>;

interface BulkResult {
  requested: number;
  succeeded: number;
  failed: number;
  errors?: Array<{ index: number; message: string }>;
}
```

### Status / error-code types

```ts
type HttpStatusCode = 200 | 201 | 202 | 204 | 400 | 401 | 403 | 404 | 405 |
  409 | 410 | 412 | 413 | 415 | 422 | 429 | 500 | 501 | 502 | 503 | 504 | (number & {});

type ErrorCode = "BAD_REQUEST" | "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" |
  "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "CONFLICT" | "GONE" | "PRECONDITION_FAILED" |
  "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE" | "UNPROCESSABLE_ENTITY" |
  "TOO_MANY_REQUESTS" | "INTERNAL_SERVER_ERROR" | "NOT_IMPLEMENTED" | "BAD_GATEWAY" |
  "SERVICE_UNAVAILABLE" | "GATEWAY_TIMEOUT" | "UNKNOWN_ERROR" | (string & {});
```

The runtime constants `HttpStatus` and `ErrorCode` live in
[errors.md](errors.md).
