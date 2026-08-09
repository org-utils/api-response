// fastify-validation-plugin.ts
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ErrorTree, ZodErrors } from "../../utils/zod/zodError.js";
import { ErrorDetail } from "client-api-types";

/**
 * Decorator added to Fastify instance for manual validation.
 *
 * @example
 * ```typescript
 * // Validate body
 * const result = fastify.validate.body(
 *   z.object({ email: z.string().email() }),
 *   req.body
 * );
 *
 * if (result.success) {
 *   // result.data: { email: string }
 * } else {
 *   // result.errors: ErrorDetail[]
 *   // result.tree: ErrorTree
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Validate query
 * const result = fastify.validate.query(
 *   z.object({ page: z.coerce.number().min(1).default(1) }),
 *   req.query
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Validate params
 * const result = fastify.validate.params(
 *   z.object({ id: z.string().uuid() }),
 *   req.params
 * );
 * ```
 */
/**
 * Result of a validation operation
 */
type ValidationResults<T> =
  | {
      success: true;
      /** Validated and typed data */
      data: T;
    }
  | {
      success: false;
      /** Flat array of validation errors */
      errors: ErrorDetail[];
      /** Nested tree structure of errors */
      tree: ErrorTree;
    };
// Type definitions for the decorator
declare module "fastify" {
  interface FastifyInstance {
    validate: {
      /**
       * Validates request body against a Zod schema
       * @template T - The inferred type from the schema
       * @param schema - The Zod schema to validate against
       * @param data - The data to validate (usually req.body)
       * @returns Validation result with typed data or errors
       */
      body<T>(schema: z.ZodSchema<T>, data: any): ValidationResults<T>;

      /**
       * Validates query parameters against a Zod schema
       * @template T - The inferred type from the schema
       * @param schema - The Zod schema to validate against
       * @param data - The data to validate (usually req.query)
       * @returns Validation result with typed data or errors
       */
      query<T>(schema: z.ZodSchema<T>, data: any): ValidationResults<T>;

      /**
       * Validates URL parameters against a Zod schema
       * @template T - The inferred type from the schema
       * @param schema - The Zod schema to validate against
       * @param data - The data to validate (usually req.params)
       * @returns Validation result with typed data or errors
       */
      params<T>(schema: z.ZodSchema<T>, data: any): ValidationResults<T>;
    };
  }
}

/**
 * Fastify plugin that adds Zod validation with automatic error formatting.
 *
 * Adds `validate` decorator to Fastify instance with methods for validating
 * request body, query parameters, and URL parameters.
 *
 * @example
 * ```typescript
 * import fastifyValidationPlugin from './fastify-validation-plugin.js';
 *
 * // Register the plugin
 * await fastify.register(fastifyValidationPlugin);
 *
 * // Use the validate decorator
 * const result = fastify.validate.body(userSchema, req.body);
 * if (result.success) {
 *   // result.data is validated and typed
 * } else {
 *   // result.errors contains formatted validation errors
 * }
 * ```
 *
 */
export const fastifyValidationPlugin: FastifyPluginAsync = async (fastify) => {
  // Add validation decorator
  fastify.decorate("validate", {
    body: <T>(schema: z.ZodSchema<T>, body: any) => {
      try {
        return { success: true, data: schema.parse(body) };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = ZodErrors.parse(error);
          return { success: false, errors: errors.flat, tree: errors.tree };
        }
        throw error;
      }
    },
    query: <T>(schema: z.ZodSchema<T>, query: any) => {
      try {
        return { success: true, data: schema.parse(query) };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = ZodErrors.parse(error);
          return { success: false, errors: errors.flat, tree: errors.tree };
        }
        throw error;
      }
    },
    params: <T>(schema: z.ZodSchema<T>, params: any) => {
      try {
        return { success: true, data: schema.parse(params) };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = ZodErrors.parse(error);
          return { success: false, errors: errors.flat, tree: errors.tree };
        }
        throw error;
      }
    },
  });
};

export default fastifyValidationPlugin;
