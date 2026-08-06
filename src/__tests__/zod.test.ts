import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fromZodError } from "../integrations/zod.js";
import { ValidationError } from "../errors/app-error.js";

describe("fromZodError", () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().min(18),
  });

  it("converts a ZodError into a ValidationError with field-level details", () => {
    const result = schema.safeParse({ email: "not-an-email", age: 10 });
    expect(result.success).toBe(false);
    if (result.success) return;

    const err = fromZodError(result.error);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(422);
    expect(err.details).toHaveLength(2);
    expect(err.details?.map((d) => d.field).sort()).toEqual(["age", "email"]);
  });

  it("joins nested paths with dots", () => {
    const nested = z.object({ address: z.object({ zip: z.string().min(5) }) });
    const result = nested.safeParse({ address: { zip: "1" } });
    if (result.success) throw new Error("expected failure");

    const err = fromZodError(result.error);
    expect(err.details?.[0]?.field).toBe("address.zip");
  });

  it("preserves the original ZodError as cause", () => {
    const result = schema.safeParse({ email: "bad", age: 1 });
    if (result.success) throw new Error("expected failure");

    const err = fromZodError(result.error);
    expect(err.cause).toBe(result.error);
  });
});
