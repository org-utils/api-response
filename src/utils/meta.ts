import { randomUUID } from "node:crypto";
import type { ResponseMeta } from "../types/response.js";

/** Generates a request id suitable for correlating logs/responses when the caller doesn't already have one (e.g. from a header). */
export function generateRequestId(): string {
  return randomUUID();
}

export function buildMeta(overrides?: Partial<ResponseMeta>): ResponseMeta {
  return {
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}
