/** Sort direction, reused across offset and cursor pagination params. */
export type SortOrder = "asc" | "desc";

export interface SortParams {
  sortBy?: string;
  sortOrder?: SortOrder;
}

// ---------------------------------------------------------------------------
// Offset-based pagination (page/limit) - simplest, best for small/medium
// datasets and UIs that need "jump to page N" / total counts.
// ---------------------------------------------------------------------------

export interface OffsetPaginationParams {
  /** 1-indexed page number. */
  page: number;
  /** Items per page. */
  limit: number;
}

export interface OffsetPaginationMeta {
  type: "offset";
  page: number;
  limit: number;
  /** Total number of items across all pages. */
  total: number;
  /** Total number of pages, ceil(total / limit). 0 when total is 0. */
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ---------------------------------------------------------------------------
// Cursor-based pagination - stable under concurrent writes, no expensive
// COUNT(*)/OFFSET scans, the standard choice for large or fast-moving feeds.
// ---------------------------------------------------------------------------

export interface CursorPaginationParams {
  /** Opaque cursor from a previous response's `nextCursor`/`prevCursor`. Omitted for the first page. */
  cursor?: string;
  limit: number;
  direction?: "forward" | "backward";
}

export interface CursorPaginationMeta {
  type: "cursor";
  limit: number;
  nextCursor: string | null;
  prevCursor: string | null;
  hasNext: boolean;
  hasPrev: boolean;
}

export type PaginationMeta = OffsetPaginationMeta | CursorPaginationMeta;

export type PaginationParams = OffsetPaginationParams | CursorPaginationParams;

/** Narrowing helpers so consumers don't need to hand-roll `"type" in meta` checks. */
export function isOffsetPagination(meta: PaginationMeta): meta is OffsetPaginationMeta {
  return meta.type === "offset";
}

export function isCursorPagination(meta: PaginationMeta): meta is CursorPaginationMeta {
  return meta.type === "cursor";
}
