# API Reference

Complete reference for every method, error class, and config type exported by
`api-response-tsjs`.

## Entry points

| Module | Docs | Contents |
|---|---|---|
| `api-response-tsjs` | [core.md](core.md) | Response builders, pagination helpers, `generateRequestId`, shared types |
| `api-response-tsjs` (errors) | [errors.md](errors.md) | `AppError` hierarchy, `HttpStatus`, `ErrorCode`, `normalizeError`, `httpError`, `createAppError` |
| `api-response-tsjs/express` | [express.md](express.md) | `asyncHandler`, `errorHandler`, `notFoundHandler`, `routeWrapper`, `validateRequest` |
| `api-response-tsjs/fastify` | [fastify.md](fastify.md) | `createErrorHandler`, `notFoundHandler`, `validateRequest` |
| `api-response-tsjs/hono` | [hono.md](hono.md) | `createErrorHandler`, `notFoundHandler` |
| `api-response-tsjs/zod` | [zod.md](zod.md) | `fromZodError`, `ZodErrors`, `getIssueMessage`, `fastifyValidationPlugin` |

## Quick overview

```
success: true  →  { success, statusCode, message?, data, pagination?, meta }
success: false →  { success, statusCode, error: { code, message, details?, stack? }, meta }
```

- Every builder produces one half of the `ApiResponse<T>` discriminated union.
- Narrow with a single check: `if (response.success) { response.data } else { response.error }`.
- `meta` always contains an ISO `timestamp`; `requestId` is added by the
  framework adapters when the request carries `x-request-id` (Express/Hono) or
  a string `request.id` (Fastify).
