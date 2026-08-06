import z, { type ZodError } from "zod";
import { ErrorDetail } from "../../types/response.js";

export interface ErrorTree {
  [key: string]: ErrorTree | ErrorDetail[];
}

export interface ParsedZodError {
  tree: ErrorTree;
  flat: ErrorDetail[];
  messages: string[];
  pretty: string;
  success: false;
}

export class ZodErrors {
  /**
   * Parse a ZodSchema and return a parsed error or data.
   */
  static safeParse<T>(schema: z.ZodSchema, data: T): ParsedZodError | z.ZodSafeParseSuccess<T> {
    const result = schema.safeParse(data);
    if (result.success) {
      return result as z.ZodSafeParseSuccess<T>;
    }
    return this.parse(result.error) as ParsedZodError;
  }

  /**
   * Convert a ZodError into multiple useful formats.
   */
  static parse(error: ZodError): ParsedZodError {
    const tree = this.tree(error);
    const flat = this.flatten(tree);

    return {
      tree,
      flat,
      messages: flat.map((e) => e.message),
      pretty: z.prettifyError(error),
      success: false,
    };
  }

  /**
   * Convert ZodError into a nested object.
   */
  static tree(error: ZodError): ErrorTree {
    const root: ErrorTree = {};

    for (const issue of error.issues) {
      this.insert(root, issue);
    }

    return root;
  }

  /**
   * Flatten nested tree.
   */
  static flatten(tree: ErrorTree): ErrorDetail[] {
    const result: ErrorDetail[] = [];

    const visit = (node: ErrorTree | ErrorDetail[]) => {
      if (Array.isArray(node)) {
        result.push(...node);
        return;
      }

      for (const value of Object.values(node)) {
        visit(value);
      }
    };

    visit(tree);

    return result;
  }

  /**
   * Human readable messages.
   */
  static messages(error: ZodError): string[] {
    return error.issues.map((i) => i.message);
  }

  /**
   * Pretty CLI output.
   */
  static pretty(error: ZodError): string {
    return z.prettifyError(error);
  }

  /**
   * Build nested tree.
   */
  private static insert(tree: ErrorTree, issue: z.core.$ZodIssue) {
    const detail: ErrorDetail = {
      field: issue.path.length ? this.path(issue.path as string[]) : undefined,
      message: this.message(issue),
      code: issue.code,
    };

    if (issue.path.length === 0) {
      tree._root ??= [];
      (tree._root as ErrorDetail[]).push(detail);
      return;
    }

    let current = tree;

    issue.path.forEach((segment, index) => {
      const key = String(segment);

      if (index === issue.path.length - 1) {
        current[key] ??= [];
        (current[key] as ErrorDetail[]).push(detail);
        return;
      }

      current[key] ??= {};
      current = current[key] as ErrorTree;
    });
  }

  /**
   * Convert path array into dot notation.
   *
   * user.address.street
   * users[0].email
   */
  private static path(path: readonly (string | number)[]): string {
    return path.reduce<string>((result, part) => {
      if (typeof part === "number") {
        return `${result}[${part}]`;
      }

      return result
        ? `${result}.${typeof part === "symbol" ? String(part) : part}`
        : String(part);
    }, "");
  }
  // private static path(path: readonly (string | number)[]): string {
  //   return path.reduce<string>((acc, segment) => {
  //     if (typeof segment === "number") {
  //       return `${acc}[${segment}]`;
  //     }

  //     return acc ? `${acc}.${segment}` : segment;
  //   }, "");
  // }

  /**
   * Customize messages here.
   *
   * Unknown issue types automatically fall back to Zod's message.
   */
  private static message(issue: z.core.$ZodIssue): string {
    switch (issue.code) {
      case "invalid_format":
        return issue.message;

      case "invalid_type":
        return issue.message;

      case "too_small":
        return issue.message;

      case "too_big":
        return issue.message;

      case "invalid_union":
        return issue.message;

      case "invalid_value":
        return issue.message;

      case "invalid_key":
        return issue.message;

      case "invalid_element":
        return issue.message;

      case "not_multiple_of":
        return issue.message;

      case "unrecognized_keys":
        return issue.message;

      case "custom":
        return issue.message;

      default:
        return (issue as any).message;
    }
  }
}
