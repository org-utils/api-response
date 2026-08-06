
export type ValidationPath = readonly (string | number)[];

export interface ValidationIssue {
  path: ValidationPath;
  field: string;
  message: string;
  code: string;
}

export interface ValidationTree {
  errors: ValidationIssue[];
  children: Record<string, ValidationTree>;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  tree: ValidationTree;
  messages: string[];
}
