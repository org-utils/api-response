import { describe, expect, it } from "vitest";
import {
  AppError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
} from "../errors/app-error.js";
import { isAppError, normalizeError } from "../errors/normalize.js";
import { errorResponse } from "../responses/error.js";
import { HttpStatus } from "../types/http-status.js";
import { ErrorCode } from "../errors/error-codes.js";

describe("built-in error classes", () => {
  it("NotFoundError carries the right status code and error code", () => {
    const err = new NotFoundError("User not found");
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(err.code).toBe(ErrorCode.NOT_FOUND);
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe("NotFoundError");
  });

  it("ValidationError carries field-level details", () => {
    const err = new ValidationError("Invalid input", [{ field: "email", message: "must be a valid email" }]);
    expect(err.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(err.details).toHaveLength(1);
    expect(err.details?.[0]?.field).toBe("email");
  });

  it("InternalServerError defaults to isOperational: false", () => {
    const err = new InternalServerError("boom");
    expect(err.isOperational).toBe(false);
  });

  it("ConflictError defaults isOperational to true like other 4xx errors", () => {
    const err = new ConflictError();
    expect(err.isOperational).toBe(true);
    expect(err.statusCode).toBe(HttpStatus.CONFLICT);
  });

  it("TooManyRequestsError exposes retryAfterSeconds when provided", () => {
    const err = new TooManyRequestsError("Slow down", 30);
    expect(err.retryAfterSeconds).toBe(30);
  });

  it("toJSON() omits stack unless explicitly requested", () => {
    const err = new NotFoundError("gone");
    const withoutStack = err.toJSON();
    const withStack = err.toJSON(true);
    expect(withoutStack.stack).toBeUndefined();
    expect(withStack.stack).toBeDefined();
  });

  it("preserves the original error as `cause`", () => {
    const original = new Error("db connection refused");
    const err = new InternalServerError("Failed to save user", { cause: original });
    expect(err.cause).toBe(original);
  });
});

describe("normalizeError", () => {
  it("passes AppError instances through unchanged", () => {
    const err = new NotFoundError("x");
    expect(normalizeError(err)).toBe(err);
  });

  it("wraps a plain Error into a non-operational InternalServerError, preserving the message", () => {
    const err = normalizeError(new Error("unexpected"));
    expect(isAppError(err)).toBe(true);
    expect(err.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(err.isOperational).toBe(false);
    expect(err.message).toBe("unexpected");
  });

  it("wraps a thrown string", () => {
    const err = normalizeError("something broke");
    expect(err.message).toBe("something broke");
  });

  it("wraps a thrown non-Error value without crashing", () => {
    const err = normalizeError({ weird: true });
    expect(err.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(err.message).toBe("An unexpected error occurred");
  });

  it("wraps undefined/null safely", () => {
    expect(() => normalizeError(undefined)).not.toThrow();
    expect(() => normalizeError(null)).not.toThrow();
  });
});

describe("errorResponse builder", () => {
  it("produces a well-formed ErrorResponse from an AppError", () => {
    const res = errorResponse(new ValidationError("bad input", [{ field: "age", message: "must be positive" }]));
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(res.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(res.error.details).toHaveLength(1);
    expect(res.error.stack).toBeUndefined();
  });

  it("includes stack only when includeStack is true", () => {
    const res = errorResponse(new Error("kaboom"), { includeStack: true });
    expect(res.error.stack).toBeDefined();
  });

  it("normalizes arbitrary thrown values instead of throwing itself", () => {
    expect(() => errorResponse("just a string")).not.toThrow();
    const res = errorResponse("just a string");
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(500);
  });
});
