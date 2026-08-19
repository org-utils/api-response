# api-response-tsjs

## 0.1.0

### Minor Changes

- [`8ef045b`](https://github.com/org-utils/api-response/commit/8ef045b246d724687476ea9c31197c29e569b1c0) Thanks [@Anwarkamal143](https://github.com/Anwarkamal143)! - - **Decoupled zod from the core and framework adapters.** The main entry and `api-response-tsjs/express` / `api-response-tsjs/fastify` no longer import zod at module load, so they work without zod installed. Everything zod-specific (`ZodErrors`, `getIssueMessage`, `fastifyValidationPlugin`) now lives in the `api-response-tsjs/zod` subpath, alongside `fromZodError`.
  - **Fixed the main entry never exporting the error classes** (`AppError`, `NotFoundError`, `normalizeError`, `HttpStatus`, `isAppError`, ... were documented but never actually exported). The `export *` chain through the errors module was dropped by the bundler, so these are now explicit named re-exports. `ErrorCode` keeps the runtime constant.
  - **Fixed broken subpath types**: the `exports` map pointed at `./dist/express.d.ts` etc., but declarations are emitted under `./dist/middleware/...` - the types condition now points at the real files, so `api-response-tsjs/express`, `/fastify`, `/hono`, and `/zod` resolve their `.d.ts` correctly.
  - **`client-api-types` moved from devDependencies to dependencies** so consumers can resolve the published `.d.ts` (which re-exports its types) without `skipLibCheck`. It's a type-only package with no runtime cost. The re-export was also narrowed to the `api` + `shared` subpaths - the full-package re-export leaked `client/` types that require `axios` to typecheck.
  - **`validateRequest` is now schema-agnostic** in the Express and Fastify adapters - pass any schema exposing a `.parse(data)` method (zod, valibot, arktype, yup, ...). Thrown `{ issues: [...] }` failures are converted into a `ValidationError` with field-level `details`. Fastify's version now uses a consistent `Invalid <location> parameters` message instead of a pretty-printed string.
  - **Added a Hono adapter**: `api-response-tsjs/hono` exports `createErrorHandler` and `notFoundHandler` (`app.onError(...)` / `app.notFound(...)`).

### Patch Changes

- [`79944ca`](https://github.com/org-utils/api-response/commit/79944caa57e22fc356c7d97d8840a111ba305119) Thanks [@Anwarkamal143](https://github.com/Anwarkamal143)! - Patched the version and added hono adapter

## 0.0.8

### Patch Changes

- [`a586702`](https://github.com/org-utils/api-response/commit/a586702c9df3a54499abe1fa7081911c23571dbe) Thanks [@Anwarkamal143](https://github.com/Anwarkamal143)! - updated typescript deps

## 0.0.7

### Patch Changes

- [`307b2b3`](https://github.com/org-utils/api-response/commit/307b2b3debcf56341ffc07061fca935108f6a9ad) Thanks [@Anwarkamal143](https://github.com/Anwarkamal143)! - updated packages version

- [`307b2b3`](https://github.com/org-utils/api-response/commit/307b2b3debcf56341ffc07061fca935108f6a9ad) Thanks [@Anwarkamal143](https://github.com/Anwarkamal143)! - updated ts cofnig

## 0.0.6

### Patch Changes

- [`f258cac`](https://github.com/org-utils/api-response/commit/f258cac978c535da26160643abc16121aad1f764) Thanks [@Anwarkamal143](https://github.com/Anwarkamal143)! - first changeset
