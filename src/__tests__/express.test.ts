import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { asyncHandler, errorHandler, notFoundHandler } from "../middleware/express.js";
import { NotFoundError, TooManyRequestsError, ValidationError } from "../errors/app-error.js";
import { ok } from "../responses/success.js";

function buildApp() {
  const app = express();
  app.use(express.json());

  app.get(
    "/users/:id",
    asyncHandler(async (req, res) => {
      if (req.params.id === "missing") {
        throw new NotFoundError(`User ${req.params.id} not found`);
      }
      res.json(ok({ id: req.params.id, name: "Ada" }));
    }),
  );

  app.post(
    "/validate",
    asyncHandler(async (req) => {
      if (!req.body?.email) {
        throw new ValidationError("Invalid input", [{ field: "email", message: "email is required" }]);
      }
    }),
  );

  app.get(
    "/rate-limited",
    asyncHandler(async () => {
      throw new TooManyRequestsError("Slow down", 42);
    }),
  );

  app.get(
    "/boom",
    asyncHandler(async () => {
      throw new Error("unexpected failure");
    }),
  );

  app.use(notFoundHandler());
  app.use(errorHandler({ includeStack: false }));

  return app;
}

describe("express adapter", () => {
  it("returns the success envelope for a normal route", async () => {
    const res = await request(buildApp()).get("/users/1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ id: "1", name: "Ada" });
  });

  it("asyncHandler forwards a thrown AppError to the error handler with the right status", async () => {
    const res = await request(buildApp()).get("/users/missing");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("surfaces ValidationError details", async () => {
    const res = await request(buildApp()).post("/validate").send({});
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([{ field: "email", message: "email is required" }]);
  });

  it("sets Retry-After for TooManyRequestsError", async () => {
    const res = await request(buildApp()).get("/rate-limited");
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBe("42");
  });

  it("wraps an unexpected Error as a 500 and omits the stack when includeStack is false", async () => {
    const res = await request(buildApp()).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(res.body.error.stack).toBeUndefined();
  });

  it("notFoundHandler + errorHandler produce a consistent 404 for unmatched routes", async () => {
    const res = await request(buildApp()).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
