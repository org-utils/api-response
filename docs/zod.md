# Zod Integration (`api-response-tsjs/zod`)

```ts
import {
  fromZodError,
  ZodErrors,
  getIssueMessage,
  fastifyValidationPlugin,
} from "api-response-tsjs/zod";
import type { ErrorTree, ParsedZodError } from "api-response-tsjs/zod";
```

Optional integration; install `zod` (`^4.4.3`) to use it. The main entry
point and all framework adapters remain zod-free.

---

## `fromZodError(error, message?)`

```ts
function fromZodError(error: ZodError, message?: string): ValidationError
```

Converts a Zod validation failure into the library's `ValidationError`,
preserving each issue as a field-level `ErrorDetail`:

| `ErrorDetail` field | Source |
|---|---|
| `message` | `issue.message` |
| `code` | `issue.code` |
| `field` | `issue.path.join(".")` (omitted for root-level issues) |

```ts
const result = createUserSchema.safeParse(req.body);
if (!result.success) throw fromZodError(result.error);
// ValidationError: 422 VALIDATION_ERROR, cause = the ZodError

// with a custom summary message:
throw fromZodError(result.error, "User data is invalid");
```

When thrown inside a route handled by any of the framework adapters
(`errorHandler`, `createErrorHandler`), it becomes a 422 `ErrorResponse`
whose `error.details` mirrors the zod issues.

---

## `ZodErrors`

Static utility class for turning a `ZodError` into multiple useful formats.

### `ZodErrors.parse(error)`

```ts
static parse(error: ZodError): ParsedZodError
```

Everything in one call:

```ts
const { tree, flat, messages, pretty } = ZodErrors.parse(result.error);
```

### `ZodErrors.tree(error)`

```ts
static tree(error: ZodError): ErrorTree
```

Nested object keyed by field path. Array indices become `[i]` keys; root-level
issues live under `_root`.

```ts
{
  user: {
    address: {
      street: [
        { field: "user.address.street", message: "Invalid input: expected string, received number", code: "invalid_type" },
      ],
    },
  },
  tags: {
    "[1]": [{ field: "tags[1]", message: "Invalid array element", code: "invalid_element" }],
  },
}
```

### `ZodErrors.flatten(tree)`

```ts
static flatten(tree: ErrorTree): ErrorDetail[]
```

Flattens a tree back into a flat `ErrorDetail[]` (used internally by
`ZodErrors.parse`).

### `ZodErrors.messages(error)`

```ts
static messages(error: ZodError): string[]
```

Human-readable messages, one per issue.

### `ZodErrors.pretty(error)`

```ts
static pretty(error: ZodError): string
```

Pretty-printed, colorized CLI output via zod's `z.prettifyError`. Great for
`console.error` in development.

### Types

```ts
interface ErrorTree {
  [key: string]: ErrorTree | ErrorDetail[];
}

interface ParsedZodError {
  tree: ErrorTree;
  flat: ErrorDetail[];
  messages: string[];
  pretty: string;
}
```

---

## `getIssueMessage(issue)`

```ts
function getIssueMessage(issue: z.core.$ZodIssue): string
```

Formats a single zod issue into a readable, field-prefixed message, e.g.
`email must be a valid email address.` or `password must contain at least 8
characters.` Covers `invalid_type`, `too_small`/`too_big` (string/array/number/
date), `invalid_format` (email, url, uuid, ipv4/6, datetime, ...),
`invalid_union`, `unrecognized_keys`, `not_multiple_of`, `invalid_key`,
`invalid_element`; everything else falls back to the issue's own message.

---

## `fastifyValidationPlugin`

```ts
const fastifyValidationPlugin: FastifyPluginAsync
```

Fastify plugin that decorates the instance with a `validate` namespace:

```ts
import Fastify from "fastify";
import { fastifyValidationPlugin } from "api-response-tsjs/zod";

const app = Fastify();
await app.register(fastifyValidationPlugin);

app.get("/users", async (req) => {
  const result = app.validate.query(querySchema, req.query);
  if (!result.success) {
    throw new ValidationError("Invalid query parameters", result.errors);
  }
  return ok(await users.list(result.data));
});
```

### Decorated API

```ts
app.validate.body<T>(schema: z.ZodSchema<T>, data: any): ValidationResults<T>
app.validate.query<T>(schema: z.ZodSchema<T>, data: any): ValidationResults<T>
app.validate.params<T>(schema: z.ZodSchema<T>, data: any): ValidationResults<T>
```

```ts
type ValidationResults<T> =
  | { success: true; data: T }                                  // parsed & typed
  | { success: false; errors: ErrorDetail[]; tree: ErrorTree }; // formatted failures
```

Non-zod errors (e.g. a schema throwing something else) are rethrown unchanged.
The default export is the same plugin.
