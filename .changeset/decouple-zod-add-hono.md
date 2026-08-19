---
"api-response-tsjs": minor
---

- **Decoupled zod from the core and framework adapters.** The main entry and `api-response-tsjs/express` / `api-response-tsjs/fastify` no longer import zod at module load, so they work without zod installed. Everything zod-specific (`ZodErrors`, `getIssueMessage`, `fastifyValidationPlugin`) now lives in the `api-response-tsjs/zod` subpath, alongside `fromZodError`.
- **Fixed the main entry never exporting the error classes** (`AppError`, `NotFoundError`, `normalizeError`, `HttpStatus`, `isAppError`, ... were documented but never actually exported). The `export *` chain through the errors module was dropped by the bundler, so these are now explicit named re-exports. `ErrorCode` keeps the runtime constant.
- **Fixed broken subpath types**: the `exports` map pointed at `./dist/express.d.ts` etc., but declarations are emitted under `./dist/middleware/...` - the types condition now points at the real files, so `api-response-tsjs/express`, `/fastify`, `/hono`, and `/zod` resolve their `.d.ts` correctly.
- **`client-api-types` moved from devDependencies to dependencies** so consumers can resolve the published `.d.ts` (which re-exports its types) without `skipLibCheck`. It's a type-only package with no runtime cost. The re-export was also narrowed to the `api` + `shared` subpaths - the full-package re-export leaked `client/` types that require `axios` to typecheck.
- **`validateRequest` is now schema-agnostic** in the Express and Fastify adapters - pass any schema exposing a `.parse(data)` method (zod, valibot, arktype, yup, ...). Thrown `{ issues: [...] }` failures are converted into a `ValidationError` with field-level `details`. Fastify's version now uses a consistent `Invalid <location> parameters` message instead of a pretty-printed string.
- **Added a Hono adapter**: `api-response-tsjs/hono` exports `createErrorHandler` and `notFoundHandler` (`app.onError(...)` / `app.notFound(...)`).
