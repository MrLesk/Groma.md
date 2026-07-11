export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

export function success<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function failure<T = never>(...diagnostics: readonly Diagnostic[]): Result<T> {
  return { diagnostics, ok: false };
}
