import { ValidationError } from "../errors/app-error.js";

/**
 * Encodes an arbitrary JSON-serializable payload (typically the sort-key
 * values of the last item on a page, e.g. `{ id, createdAt }`) into an
 * opaque, URL-safe cursor string. Callers should treat the result as a
 * black box - decode it with `decodeCursor` using the same shape.
 */
export function encodeCursor<T extends Record<string, unknown>>(payload: T): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf8").toString("base64url");
}

/**
 * Decodes a cursor previously produced by `encodeCursor`. Throws a
 * `ValidationError` (400-class, operational) rather than a generic parse
 * error if the cursor is malformed or tampered with, so it maps cleanly to
 * a 4xx response instead of a 500 when a client sends garbage.
 */
export function decodeCursor<T extends Record<string, unknown> = Record<string, unknown>>(cursor: string): T {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Decoded cursor is not an object");
    }
    return parsed as T;
  } catch {
    throw new ValidationError("Invalid or corrupted pagination cursor", [
      { field: "cursor", message: "The provided cursor could not be decoded", code: "invalid_cursor" },
    ]);
  }
}
