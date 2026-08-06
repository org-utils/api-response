import type { OffsetPaginationMeta, OffsetPaginationParams } from "../types/pagination.js";
import { ValidationError } from "../errors/app-error.js";

export interface OffsetParamsConfig {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
}

const DEFAULTS: Required<OffsetParamsConfig> = {
  defaultPage: 1,
  defaultLimit: 20,
  maxLimit: 100,
};

function toPositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
  return n;
}

/**
 * Parses raw, untrusted input (e.g. `req.query.page`, `req.query.limit` -
 * strings, possibly missing, possibly garbage) into validated
 * `OffsetPaginationParams`. Throws `ValidationError` on clearly invalid
 * input (negative/zero/non-numeric) rather than silently coercing it, so
 * bad requests fail loudly instead of quietly returning the wrong page.
 * `limit` is transparently clamped to `maxLimit` rather than rejected, since
 * "you asked for too much" is a reasonable thing to just cap.
 */
export function parseOffsetParams(
  input: { page?: unknown; limit?: unknown },
  config: OffsetParamsConfig = {},
): OffsetPaginationParams {
  const { defaultPage, defaultLimit, maxLimit } = { ...DEFAULTS, ...config };

  const details: { field: string; message: string; code: string }[] = [];

  let page = defaultPage;
  if (input.page !== undefined) {
    const parsed = toPositiveInt(input.page);
    if (parsed === undefined || parsed < 1) {
      details.push({ field: "page", message: "page must be a positive integer", code: "invalid_page" });
    } else {
      page = parsed;
    }
  }

  let limit = defaultLimit;
  if (input.limit !== undefined) {
    const parsed = toPositiveInt(input.limit);
    if (parsed === undefined || parsed < 1) {
      details.push({ field: "limit", message: "limit must be a positive integer", code: "invalid_limit" });
    } else {
      limit = Math.min(parsed, maxLimit);
    }
  }

  if (details.length > 0) {
    throw new ValidationError("Invalid pagination parameters", details);
  }

  return { page, limit };
}

/** SQL-style zero-indexed offset for `LIMIT ? OFFSET ?` / Drizzle's `.offset()` / Prisma's `skip`. */
export function getOffset(params: OffsetPaginationParams): number {
  return (params.page - 1) * params.limit;
}

/** Builds the response-envelope pagination metadata once you know the total row count. */
export function buildOffsetMeta(total: number, params: OffsetPaginationParams): OffsetPaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);
  return {
    type: "offset",
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
  };
}
