import type { CursorPaginationMeta, CursorPaginationParams } from "../types/pagination.js";
import { ValidationError } from "../errors/app-error.js";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";

export interface CursorParamsConfig {
  defaultLimit?: number;
  maxLimit?: number;
}

const DEFAULTS: Required<CursorParamsConfig> = {
  defaultLimit: 20,
  maxLimit: 100,
};

/** Parses raw query input (`cursor`, `limit`) into validated `CursorPaginationParams`. */
export function parseCursorParams(
  input: { cursor?: unknown; limit?: unknown; direction?: unknown },
  config: CursorParamsConfig = {},
): CursorPaginationParams {
  const { defaultLimit, maxLimit } = { ...DEFAULTS, ...config };

  let limit = defaultLimit;
  if (input.limit !== undefined) {
    const parsed = Number(input.limit);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      throw new ValidationError("Invalid pagination parameters", [
        { field: "limit", message: "limit must be a positive integer", code: "invalid_limit" },
      ]);
    }
    limit = Math.min(parsed, maxLimit);
  }

  const params: CursorPaginationParams = { limit };

  if (input.cursor !== undefined && input.cursor !== null && input.cursor !== "") {
    if (typeof input.cursor !== "string") {
      throw new ValidationError("Invalid pagination parameters", [
        { field: "cursor", message: "cursor must be a string", code: "invalid_cursor" },
      ]);
    }
    params.cursor = input.cursor;
  }

  if (input.direction === "forward" || input.direction === "backward") {
    params.direction = input.direction;
  }

  return params;
}

export { encodeCursor, decodeCursor };

export interface CursorPageResult<T> {
  items: T[];
  meta: CursorPaginationMeta;
}

/**
 * Builds cursor pagination metadata from an **over-fetched** page: query your
 * data source for `limit + 1` rows, pass the raw result here, and this
 * function detects whether there's a next page, trims the extra row, and
 * derives `nextCursor` from the last item using `getCursorPayload`.
 *
 *   const rows = await db.query.posts.findMany({
 *     where: cursor ? gt(posts.id, decodeCursor(cursor).id) : undefined,
 *     orderBy: asc(posts.id),
 *     limit: limit + 1,
 *   });
 *   const page = buildCursorPage(rows, limit, (post) => ({ id: post.id }));
 *
 * `prevCursor` is derived from the first item of the trimmed page whenever a
 * cursor was supplied on the request (i.e. this isn't the first page) -
 * good enough for "back" navigation in most feeds. For exact bidirectional
 * cursoring, fetch one extra row on the *other* end too and pass
 * `hasPrevOverride`.
 */
export function buildCursorPage<T>(
  overFetchedItems: T[],
  limit: number,
  getCursorPayload: (item: T) => Record<string, unknown>,
  options: { requestCursor?: string; hasPrevOverride?: boolean } = {},
): CursorPageResult<T> {
  const hasNext = overFetchedItems.length > limit;
  const items = hasNext ? overFetchedItems.slice(0, limit) : overFetchedItems;

  const lastItem = items.at(-1);
  const firstItem = items.at(0);

  const nextCursor = hasNext && lastItem !== undefined ? encodeCursor(getCursorPayload(lastItem)) : null;
  const hasPrev = options.hasPrevOverride ?? options.requestCursor !== undefined;
  const prevCursor = hasPrev && firstItem !== undefined ? encodeCursor(getCursorPayload(firstItem)) : null;

  return {
    items,
    meta: {
      type: "cursor",
      limit,
      nextCursor,
      prevCursor,
      hasNext,
      hasPrev,
    },
  };
}
