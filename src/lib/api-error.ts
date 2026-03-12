/**
 * Typed helpers for PostgreSQL and application errors in API catch blocks.
 * Replaces `error: any` with safe type narrowing.
 */

/** PostgreSQL error shape (from `pg` library) */
interface PgError extends Error {
  code?: string;       // e.g. '23505' (unique_violation), '23503' (foreign_key_violation)
  constraint?: string; // constraint name that triggered the error
  detail?: string;     // human-readable detail
}

/** Application-level error with custom code (thrown via Object.assign) */
interface AppError extends Error {
  code?: string;
  [key: string]: unknown;
}

/**
 * Check if an error is a PostgreSQL unique constraint violation (23505).
 */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && (error as PgError).code === '23505';
}

/**
 * Check if an error is a PostgreSQL foreign key violation (23503).
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Error && (error as PgError).code === '23503';
}

/**
 * Safely extract a custom app error code from an unknown error.
 */
export function getAppErrorCode(error: unknown): string | undefined {
  if (error instanceof Error) {
    return (error as AppError).code;
  }
  return undefined;
}

/**
 * Safely extract the error message from an unknown error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
