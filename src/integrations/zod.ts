import type { ZodError } from "zod";
import type { ErrorDetail } from "../types/response.js";
import { ValidationError } from "../errors/app-error.js";

/**
 * Converts a Zod validation failure into this library's `ValidationError`,
 * preserving each issue as a field-level `ErrorDetail`.
 *
 *   const result = createUserSchema.safeParse(req.body);
 *   if (!result.success) throw fromZodError(result.error);
 */
export function fromZodError(error: ZodError, message = "Validation failed"): ValidationError {
  const details: ErrorDetail[] = error.issues.map((issue) => {
    const detail: ErrorDetail = { message: issue.message, code: issue.code };
    if (issue.path.length > 0) detail.field = issue.path.join(".");
    return detail;
  });

  return new ValidationError(message, details, { cause: error });
}
