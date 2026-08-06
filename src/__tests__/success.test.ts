import { describe, expect, it } from "vitest";
import { accepted, created, deleted, noContent, ok, paginated, successResponse } from "../responses/success.js";
import { HttpStatus } from "../types/http-status.js";

describe("success response builders", () => {
  it("ok() produces a 200 envelope with the given data", () => {
    const res = ok({ id: 1, name: "Ada" });
    expect(res.success).toBe(true);
    expect(res.statusCode).toBe(HttpStatus.OK);
    expect(res.data).toEqual({ id: 1, name: "Ada" });
    expect(res.meta.timestamp).toBeDefined();
    expect(() => new Date(res.meta.timestamp).toISOString()).not.toThrow();
  });

  it("created() defaults to 201 with a default message", () => {
    const res = created({ id: 2 });
    expect(res.statusCode).toBe(HttpStatus.CREATED);
    expect(res.message).toBe("Resource created successfully");
  });

  it("created() allows overriding the message", () => {
    const res = created({ id: 2 }, { message: "Order placed" });
    expect(res.message).toBe("Order placed");
  });

  it("accepted() uses 202", () => {
    const res = accepted({ jobId: "abc" });
    expect(res.statusCode).toBe(HttpStatus.ACCEPTED);
  });

  it("noContent() returns null data with 204", () => {
    const res = noContent();
    expect(res.statusCode).toBe(HttpStatus.NO_CONTENT);
    expect(res.data).toBeNull();
  });

  it("deleted() defaults to a message and the given id payload", () => {
    const res = deleted({ id: "abc-123" });
    expect(res.data).toEqual({ id: "abc-123" });
    expect(res.message).toBe("Resource deleted successfully");
  });

  it("paginated() attaches pagination metadata at the envelope level, not inside data", () => {
    const meta = { type: "offset" as const, page: 1, limit: 10, total: 30, totalPages: 3, hasNext: true, hasPrev: false };
    const res = paginated([{ id: 1 }, { id: 2 }], meta);
    expect(res.data).toHaveLength(2);
    expect(res.pagination).toEqual(meta);
  });

  it("successResponse() allows merging custom meta", () => {
    const res = successResponse({ ok: true }, { meta: { requestId: "req-1", version: "v2" } });
    expect(res.meta.requestId).toBe("req-1");
    expect(res.meta.version).toBe("v2");
    expect(res.meta.timestamp).toBeDefined();
  });
});
