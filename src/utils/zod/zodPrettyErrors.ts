import z from "zod";

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((result, part) => {
    if (typeof part === "number") {
      return `${result}[${part}]`;
    }

    return result
      ? `${result}.${typeof part === "symbol" ? String(part) : part}`
      : String(part);
  }, "");
}

export function getIssueMessage(issue: z.core.$ZodIssue): string {
  const field = formatPath(issue.path) || "Value";

  switch (issue.code) {
    case "invalid_type":
      return `${field} must be ${article(issue.expected)} ${String(issue.expected)}.`;

    case "too_small": {
      const comparison = issue.inclusive ? "at least" : "greater than";

      switch (issue.origin) {
        case "string":
          return `${field} must contain ${comparison} ${issue.minimum} characters.`;

        case "array":
          return `${field} must contain ${comparison} ${issue.minimum} items.`;

        case "number":
        case "int":
        case "bigint":
          return `${field} must be ${comparison} ${issue.minimum}.`;

        case "date":
          return `${field} must be after ${issue.minimum}.`;

        default:
          return issue.message;
      }
    }

    case "too_big": {
      const comparison = issue.inclusive ? "at most" : "less than";

      switch (issue.origin) {
        case "string":
          return `${field} must contain ${comparison} ${issue.maximum} characters.`;

        case "array":
          return `${field} must contain ${comparison} ${issue.maximum} items.`;

        case "number":
        case "int":
        case "bigint":
          return `${field} must be ${comparison} ${issue.maximum}.`;

        case "date":
          return `${field} must be before ${issue.maximum}.`;

        default:
          return issue.message;
      }
    }

    case "invalid_format":
      return formatMessage(field, issue.format);

    case "invalid_value":
      return issue.message;

    case "invalid_union":
      return `${field} does not match any allowed schema.`;

    case "unrecognized_keys":
      return `Unknown keys: ${issue.keys.join(", ")}.`;

    case "not_multiple_of":
      return `${field} must be a multiple of ${issue.divisor}.`;

    case "invalid_key":
      return `Invalid object key.`;

    case "invalid_element":
      return `Invalid collection element.`;

    case "custom":
      return issue.message;

    default: {
      // Exhaustive check
      const _never: any = issue;
      return _never.message;
    }
  }
}

function formatMessage(field: string, format: string): string {
  switch (format) {
    case "email":
      return `${field} must be a valid email address.`;

    case "url":
      return `${field} must be a valid URL.`;

    case "uuid":
      return `${field} must be a valid UUID.`;

    case "guid":
      return `${field} must be a valid GUID.`;

    case "cuid":
      return `${field} must be a valid CUID.`;

    case "cuid2":
      return `${field} must be a valid CUID2.`;

    case "ulid":
      return `${field} must be a valid ULID.`;

    case "emoji":
      return `${field} must be a valid emoji.`;

    case "ip":
      return `${field} must be a valid IP address.`;

    case "ipv4":
      return `${field} must be a valid IPv4 address.`;

    case "ipv6":
      return `${field} must be a valid IPv6 address.`;

    case "datetime":
      return `${field} must be a valid ISO datetime.`;

    case "date":
      return `${field} must be a valid date.`;

    case "time":
      return `${field} must be a valid time.`;

    case "duration":
      return `${field} must be a valid ISO duration.`;

    case "regex":
      return `${field} has an invalid format.`;

    case "starts_with":
      return `${field} has an invalid prefix.`;

    case "ends_with":
      return `${field} has an invalid suffix.`;

    case "includes":
      return `${field} must contain the required value.`;

    default:
      return `${field} has an invalid format.`;
  }
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
