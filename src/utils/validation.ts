import type { ErrorDetail } from "../types/index.js";

interface IssueLike {
  message?: unknown;
  code?: unknown;
  path?: Array<string | number | symbol>;
}

export interface ParsableSchema<T> {
  parse(data: unknown): T;
}

function isIssuesError(error: unknown): error is { issues: IssueLike[] } {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

function formatPath(path: readonly (string | number | symbol)[]): string {
  return path.reduce<string>((result, part) => {
    if (typeof part === "number") {
      return `${result}[${part}]`;
    }
    const key = typeof part === "symbol" ? String(part) : part;
    return result ? `${result}.${key}` : key;
  }, "");
}

/**
 * Converts a `{ issues: [...] }`-shaped validation failure (zod, valibot,
 * arktype, ...) into this library's `ErrorDetail[]`. Returns `null` when the
 * thrown value doesn't have that shape, so callers can pass the original
 * error through untouched.
 */
export function extractValidationDetails(error: unknown): ErrorDetail[] | null {
  if (!isIssuesError(error)) return null;
  return error.issues.map((issue) => {
    const detail: ErrorDetail = {
      message: String(issue.message ?? "Invalid value"),
      code: String(issue.code ?? "invalid_value"),
    };
    if (Array.isArray(issue.path) && issue.path.length > 0) {
      detail.field = formatPath(issue.path);
    }
    return detail;
  });
}