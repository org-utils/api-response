import { describe, expect, it } from "vitest";
import { buildOffsetMeta, getOffset, parseOffsetParams } from "../responses/offset-pagination.js";
import { ValidationError } from "../errors/app-error.js";

describe("parseOffsetParams", () => {
  it("applies defaults when nothing is provided", () => {
    const params = parseOffsetParams({});
    expect(params).toEqual({ page: 1, limit: 20 });
  });

  it("parses string query values (as they'd arrive from req.query)", () => {
    const params = parseOffsetParams({ page: "3", limit: "50" });
    expect(params).toEqual({ page: 3, limit: 50 });
  });

  it("clamps limit to maxLimit instead of rejecting it", () => {
    const params = parseOffsetParams({ limit: "9999" }, { maxLimit: 100 });
    expect(params.limit).toBe(100);
  });

  it("throws ValidationError for a non-numeric page", () => {
    expect(() => parseOffsetParams({ page: "abc" })).toThrow(ValidationError);
  });

  it("throws ValidationError for a zero or negative page", () => {
    expect(() => parseOffsetParams({ page: "0" })).toThrow(ValidationError);
    expect(() => parseOffsetParams({ page: "-1" })).toThrow(ValidationError);
  });

  it("throws ValidationError for a non-integer limit", () => {
    expect(() => parseOffsetParams({ limit: "2.5" })).toThrow(ValidationError);
  });

  it("collects multiple field errors in a single ValidationError", () => {
    try {
      parseOffsetParams({ page: "-1", limit: "0" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const validationErr = err as ValidationError;
      expect(validationErr.details).toHaveLength(2);
    }
  });
});

describe("getOffset", () => {
  it("computes zero-indexed SQL offset from a 1-indexed page", () => {
    expect(getOffset({ page: 1, limit: 20 })).toBe(0);
    expect(getOffset({ page: 2, limit: 20 })).toBe(20);
    expect(getOffset({ page: 5, limit: 10 })).toBe(40);
  });
});

describe("buildOffsetMeta", () => {
  it("computes totalPages, hasNext, hasPrev correctly for a middle page", () => {
    const meta = buildOffsetMeta(95, { page: 2, limit: 20 });
    expect(meta).toEqual({
      type: "offset",
      page: 2,
      limit: 20,
      total: 95,
      totalPages: 5,
      hasNext: true,
      hasPrev: true,
    });
  });

  it("handles the first page (no prev)", () => {
    const meta = buildOffsetMeta(50, { page: 1, limit: 20 });
    expect(meta.hasPrev).toBe(false);
    expect(meta.hasNext).toBe(true);
  });

  it("handles the last page (no next)", () => {
    const meta = buildOffsetMeta(50, { page: 3, limit: 20 });
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(true);
  });

  it("handles zero results", () => {
    const meta = buildOffsetMeta(0, { page: 1, limit: 20 });
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(false);
  });
});
