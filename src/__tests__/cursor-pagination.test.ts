import { describe, expect, it } from "vitest";
import { buildCursorPage, parseCursorParams } from "../responses/cursor-pagination.js";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";
import { ValidationError } from "../errors/app-error.js";

describe("encodeCursor / decodeCursor", () => {
  it("round-trips a payload", () => {
    const cursor = encodeCursor({ id: 42, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(typeof cursor).toBe("string");
    const decoded = decodeCursor<{ id: number; createdAt: string }>(cursor);
    expect(decoded).toEqual({ id: 42, createdAt: "2026-01-01T00:00:00.000Z" });
  });

  it("produces a URL-safe string", () => {
    const cursor = encodeCursor({ id: 1 });
    expect(cursor).not.toMatch(/[+/=]/);
  });

  it("throws ValidationError on a malformed cursor instead of a raw parse error", () => {
    expect(() => decodeCursor("not-valid-base64-json!!!")).toThrow(ValidationError);
  });

  it("throws ValidationError when the decoded payload isn't an object", () => {
    const cursor = Buffer.from("42", "utf8").toString("base64url");
    expect(() => decodeCursor(cursor)).toThrow(ValidationError);
  });
});

describe("parseCursorParams", () => {
  it("applies default limit when nothing provided", () => {
    const params = parseCursorParams({});
    expect(params).toEqual({ limit: 20 });
  });

  it("passes through a valid cursor string", () => {
    const params = parseCursorParams({ cursor: "abc123", limit: "10" });
    expect(params.cursor).toBe("abc123");
    expect(params.limit).toBe(10);
  });

  it("clamps limit to maxLimit", () => {
    const params = parseCursorParams({ limit: "500" }, { maxLimit: 100 });
    expect(params.limit).toBe(100);
  });

  it("rejects a non-string cursor", () => {
    expect(() => parseCursorParams({ cursor: 123 })).toThrow(ValidationError);
  });

  it("rejects an invalid limit", () => {
    expect(() => parseCursorParams({ limit: "abc" })).toThrow(ValidationError);
  });
});

interface Row {
  id: number;
  name: string;
}

describe("buildCursorPage", () => {
  const rows: Row[] = [
    { id: 1, name: "a" },
    { id: 2, name: "b" },
    { id: 3, name: "c" },
  ];

  it("detects hasNext when the over-fetched page has limit+1 rows, and trims to limit", () => {
    const page = buildCursorPage(rows, 2, (row) => ({ id: row.id }));
    expect(page.items).toHaveLength(2);
    expect(page.items.map((r) => r.id)).toEqual([1, 2]);
    expect(page.meta.hasNext).toBe(true);
    expect(page.meta.nextCursor).not.toBeNull();
  });

  it("nextCursor decodes back to the last trimmed item's key", () => {
    const page = buildCursorPage(rows, 2, (row) => ({ id: row.id }));
    const decoded = decodeCursor<{ id: number }>(page.meta.nextCursor!);
    expect(decoded.id).toBe(2);
  });

  it("reports hasNext: false when there is no extra row", () => {
    const page = buildCursorPage(rows, 3, (row) => ({ id: row.id }));
    expect(page.items).toHaveLength(3);
    expect(page.meta.hasNext).toBe(false);
    expect(page.meta.nextCursor).toBeNull();
  });

  it("reports hasPrev: false for a first page (no request cursor)", () => {
    const page = buildCursorPage(rows, 2, (row) => ({ id: row.id }));
    expect(page.meta.hasPrev).toBe(false);
    expect(page.meta.prevCursor).toBeNull();
  });

  it("reports hasPrev: true when a request cursor was supplied", () => {
    const page = buildCursorPage(rows, 2, (row) => ({ id: row.id }), { requestCursor: "some-cursor" });
    expect(page.meta.hasPrev).toBe(true);
    expect(page.meta.prevCursor).not.toBeNull();
  });

  it("handles an empty result set without throwing", () => {
    const page = buildCursorPage<Row>([], 2, (row) => ({ id: row.id }));
    expect(page.items).toEqual([]);
    expect(page.meta.hasNext).toBe(false);
    expect(page.meta.nextCursor).toBeNull();
  });
});
