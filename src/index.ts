// Types
export type { ApiResponse, SuccessResponse, ErrorResponse, ErrorPayload, ErrorDetail, ResponseMeta } from "./types/response.js";
export type {
  PaginationMeta,
  PaginationParams,
  OffsetPaginationMeta,
  OffsetPaginationParams,
  CursorPaginationMeta,
  CursorPaginationParams,
  SortOrder,
  SortParams,
} from "./types/pagination.js";
export { isOffsetPagination, isCursorPagination } from "./types/pagination.js";
export type {
  GetOneResponse,
  ListResponse,
  CreateResponse,
  UpdateResponse,
  DeleteResponse,
  BulkResult,
  BulkResponse,
} from "./types/crud.js";
export { HttpStatus } from "./types/http-status.js";
export type { HttpStatusCode } from "./types/http-status.js";

// Errors
export {
  AppError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  MethodNotAllowedError,
  ConflictError,
  GoneError,
  PreconditionFailedError,
  PayloadTooLargeError,
  TooManyRequestsError,
  InternalServerError,
  NotImplementedError,
  BadGatewayError,
  ServiceUnavailableError,
  GatewayTimeoutError,
} from "./errors/app-error.js";
export type { AppErrorOptions } from "./errors/app-error.js";
export { ErrorCode } from "./errors/error-codes.js";
export type { ErrorCodeValue } from "./errors/error-codes.js";
export { isAppError, normalizeError } from "./errors/normalize.js";

// Response builders
export {
  successResponse,
  ok,
  created,
  accepted,
  noContent,
  deleted,
  paginated,
} from "./responses/success.js";
export type { SuccessOptions } from "./responses/success.js";
export { errorResponse } from "./responses/error.js";
export type { ErrorResponseOptions } from "./responses/error.js";

// Pagination helpers
export { parseOffsetParams, getOffset, buildOffsetMeta } from "./responses/offset-pagination.js";
export type { OffsetParamsConfig } from "./responses/offset-pagination.js";
export { parseCursorParams, buildCursorPage, encodeCursor, decodeCursor } from "./responses/cursor-pagination.js";
export type { CursorParamsConfig, CursorPageResult } from "./responses/cursor-pagination.js";

// Utilities
export { generateRequestId } from "./utils/meta.js";
