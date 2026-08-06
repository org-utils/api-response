import type { ResponseMeta, SuccessResponse } from "../types/response.js";
import type { PaginationMeta } from "../types/pagination.js";
import { HttpStatus } from "../types/http-status.js";
import { buildMeta } from "../utils/meta.js";

export interface SuccessOptions {
  message?: string;
  statusCode?: number;
  meta?: Partial<ResponseMeta>;
  pagination?: PaginationMeta;
}

/** Generic success envelope builder. Prefer the semantic helpers below (`ok`, `created`, ...) where they fit. */
export function successResponse<T>(data: T, options: SuccessOptions = {}): SuccessResponse<T> {
  const response: SuccessResponse<T> = {
    success: true,
    statusCode: options.statusCode ?? HttpStatus.OK,
    data,
    meta: buildMeta(options.meta),
  };
  if (options.message !== undefined) response.message = options.message;
  if (options.pagination !== undefined) response.pagination = options.pagination;
  return response;
}

/** 200 OK - the common case: fetching or successfully mutating a single resource. */
export function ok<T>(data: T, options: Omit<SuccessOptions, "statusCode"> = {}): SuccessResponse<T> {
  return successResponse(data, { ...options, statusCode: HttpStatus.OK });
}

/** 201 Created - conventionally used for POST endpoints that create a new resource. */
export function created<T>(data: T, options: Omit<SuccessOptions, "statusCode"> = {}): SuccessResponse<T> {
  return successResponse(data, {
    ...options,
    statusCode: HttpStatus.CREATED,
    message: options.message ?? "Resource created successfully",
  });
}

/** 202 Accepted - the request was valid and queued, but processing isn't complete (async jobs, webhooks, ...). */
export function accepted<T>(data: T, options: Omit<SuccessOptions, "statusCode"> = {}): SuccessResponse<T> {
  return successResponse(data, { ...options, statusCode: HttpStatus.ACCEPTED });
}

/**
 * 204 No Content. Note: per the HTTP spec a 204 response must not have a
 * body - if your framework lets you set a body anyway, prefer sending no
 * body at all and using this only for typing/logging purposes.
 */
export function noContent(options: Omit<SuccessOptions, "statusCode" | "message"> = {}): SuccessResponse<null> {
  return successResponse(null, { ...options, statusCode: HttpStatus.NO_CONTENT });
}

/** Success envelope for a deletion, defaulting to returning the deleted id. */
export function deleted<T = { id: string | number }>(
  data: T,
  options: Omit<SuccessOptions, "statusCode"> = {},
): SuccessResponse<T> {
  return successResponse(data, {
    ...options,
    statusCode: HttpStatus.OK,
    message: options.message ?? "Resource deleted successfully",
  });
}

/** Success envelope for a list/collection endpoint, with pagination metadata attached at the envelope level (not inside `data`). */
export function paginated<T>(
  items: T[],
  pagination: PaginationMeta,
  options: Omit<SuccessOptions, "pagination" | "statusCode"> = {},
): SuccessResponse<T[]> {
  return successResponse(items, { ...options, pagination, statusCode: HttpStatus.OK });
}
