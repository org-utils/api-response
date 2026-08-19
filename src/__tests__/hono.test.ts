import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { createErrorHandler, notFoundHandler } from "../middleware/hono.js";
import { NotFoundError, TooManyRequestsError } from "../errors/index.js";
import { ok } from "../responses/success.js";

function buildApp() {
  const app = new Hono();

  app.get("/users/:id", (c) => {
    const id = c.req.param("id");
    if (id === "missing") {
      throw new NotFoundError(`User ${id} not found`);
    }
    return c.json(ok({ id, name: "Ada" }));
  });

  app.get("/rate-limited", () => {
    throw new TooManyRequestsError("Slow down", 42);
  });

  app.get("/boom", () => {
    throw new Error("unexpected failure");
  });

  app.notFound(notFoundHandler());
  app.onError(createErrorHandler({ includeStack: false }));

  return app;
}

describe("hono adapter", () => {
  it("returns the success envelope for a normal route", async () => {
    const res = await buildApp().request("/users/1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: "1", name: "Ada" });
  });

  it("turns a thrown AppError into the right status code", async () => {
    const res = await buildApp().request("/users/missing");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("sets Retry-After for TooManyRequestsError", async () => {
    const res = await buildApp().request("/rate-limited");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
  });

  it("wraps an unexpected Error as a 500 and omits the stack when includeStack is false", async () => {
    const res = await buildApp().request("/boom");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.stack).toBeUndefined();
  });

  it("notFoundHandler + createErrorHandler produce a consistent 404 for unmatched routes", async () => {
    const res = await buildApp().request("/does-not-exist");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("includes the x-request-id header in meta when present", async () => {
    const app = buildApp();
    app.onError(createErrorHandler({ includeStack: false }));
    const res = await app.request("/users/missing", {
      headers: { "x-request-id": "req_123" },
    });
    const body = await res.json();
    expect(body.meta.requestId).toBe("req_123");
  });
});
