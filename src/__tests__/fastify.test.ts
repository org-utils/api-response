import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { createErrorHandler, notFoundHandler } from "../middleware/fastify.js";
import { NotFoundError, ValidationError } from "../errors/app-error.js";
import { ok } from "../responses/success.js";

function buildApp() {
  const app = Fastify();

  app.get("/users/:id", async (request) => {
    const { id } = request.params as { id: string };
    if (id === "missing") throw new NotFoundError(`User ${id} not found`);
    return ok({ id, name: "Ada" });
  });

  app.post("/validate", async (request) => {
    const body = request.body as { email?: string } | undefined;
    if (!body?.email) {
      throw new ValidationError("Invalid input", [{ field: "email", message: "email is required" }]);
    }
    return ok(null);
  });

  app.get("/boom", async () => {
    throw new Error("unexpected failure");
  });

  app.setNotFoundHandler(notFoundHandler());
  app.setErrorHandler(createErrorHandler({ includeStack: false }));

  return app;
}

describe("fastify adapter", () => {
  it("returns the success envelope for a normal route", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/users/1" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: "1", name: "Ada" });
  });

  it("thrown AppError maps to the correct status and error code", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/users/missing" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("surfaces ValidationError details", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/validate",
      payload: {},
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.details).toEqual([{ field: "email", message: "email is required" }]);
  });

  it("wraps an unexpected Error as a 500", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(res.json().error.stack).toBeUndefined();
  });

  it("notFoundHandler produces a consistent 404 body for unmatched routes", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/does-not-exist" });
    expect(res.statusCode).toBe(404);
    expect(res.json().success).toBe(false);
  });
});
