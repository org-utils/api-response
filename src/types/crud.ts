import type { SuccessResponse } from "./response.js";

/**
 * These are intentionally thin aliases over `SuccessResponse<T>`. They don't
 * change runtime behavior - the same builders produce them - but they let
 * route/controller signatures document intent:
 *
 *   async function createUser(input: CreateUserInput): Promise<CreateResponse<User>>
 *
 * reads better than a bare `Promise<SuccessResponse<User>>` at every call site.
 */

/** GET /resource/:id */
export type GetOneResponse<T> = SuccessResponse<T>;

/** GET /resource (collection) - pagination lives on the envelope, not in `data`. */
export type ListResponse<T> = SuccessResponse<T[]>;

/** POST /resource - conventionally paired with statusCode 201, see `created()`. */
export type CreateResponse<T> = SuccessResponse<T>;

/** PUT/PATCH /resource/:id */
export type UpdateResponse<T> = SuccessResponse<T>;

/** DELETE /resource/:id - `data` is typically the deleted id, or null for a 204. */
export type DeleteResponse<T = { id: string | number } | null> = SuccessResponse<T>;

/** Bulk mutation result summary, useful for batch create/update/delete endpoints. */
export interface BulkResult {
  requested: number;
  succeeded: number;
  failed: number;
  errors?: Array<{ index: number; message: string }>;
}

export type BulkResponse = SuccessResponse<BulkResult>;
